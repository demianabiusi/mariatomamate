import { Client, ConnectConfig } from 'ssh2';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SshTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  authType: 'password' | 'keyFile' | 'agent';
  password?: string;
  keyPath?: string;
  passphrase?: string;
}

export interface ActiveSshTunnel {
  localHost: string;
  localPort: number;
  targetHost: string;
  targetPort: number;
  close: () => Promise<void>;
}

export class SshTunnelService {
  /**
   * Resuelve rutas que comiencen con ~ al directorio home del usuario.
   */
  public static resolveKeyPath(keyPath: string): string {
    if (!keyPath) return '';
    const trimmed = keyPath.trim();
    if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
      return path.join(os.homedir(), trimmed.slice(2));
    }
    if (trimmed === '~') {
      return os.homedir();
    }
    return path.resolve(trimmed);
  }

  /**
   * Construye la configuración para la conexión ssh2 a partir de SshTunnelConfig.
   */
  private static buildSshConnectConfig(config: SshTunnelConfig): ConnectConfig {
    const host = config.host?.trim();
    if (!host) {
      throw new Error('El Host del servidor SSH no puede estar vacío.');
    }
    const user = config.user?.trim();
    if (!user) {
      throw new Error('El Usuario SSH no puede estar vacío.');
    }

    const sshOptions: ConnectConfig = {
      host,
      port: Number(config.port) || 22,
      username: user,
      readyTimeout: 15000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3
    };

    const authType = config.authType || 'password';

    if (authType === 'password') {
      sshOptions.password = config.password || '';
    } else if (authType === 'keyFile') {
      const keyPath = SshTunnelService.resolveKeyPath(config.keyPath || '');
      if (!keyPath) {
        throw new Error('Debe especificar la ruta al archivo de clave privada SSH.');
      }
      if (!fs.existsSync(keyPath)) {
        throw new Error(`El archivo de clave privada SSH no existe: ${keyPath}`);
      }
      try {
        sshOptions.privateKey = fs.readFileSync(keyPath);
      } catch (readErr: any) {
        throw new Error(`No se pudo leer la clave privada SSH (${keyPath}): ${readErr.message}`);
      }
      if (config.passphrase) {
        sshOptions.passphrase = config.passphrase;
      }
    } else if (authType === 'agent') {
      if (process.env.SSH_AUTH_SOCK) {
        sshOptions.agent = process.env.SSH_AUTH_SOCK;
      } else if (process.platform === 'win32') {
        sshOptions.agent = 'pageant';
      } else {
        throw new Error('No se encontró un socket de agente SSH activo (SSH_AUTH_SOCK).');
      }
    }

    return sshOptions;
  }

  /**
   * Prueba únicamente la conexión y autenticación SSH.
   */
  public async testSshConnection(config: SshTunnelConfig): Promise<{
    success: boolean;
    message: string;
    pingMs: number;
    banner?: string;
  }> {
    const start = Date.now();
    let bannerText = '';

    return new Promise((resolve) => {
      let client: Client | null = null;
      let isResolved = false;

      const finish = (success: boolean, message: string) => {
        if (isResolved) return;
        isResolved = true;
        const pingMs = Date.now() - start;
        if (client) {
          try {
            client.end();
          } catch {}
        }
        resolve({
          success,
          message,
          pingMs,
          banner: bannerText || undefined
        });
      };

      try {
        const sshOptions = SshTunnelService.buildSshConnectConfig(config);
        client = new Client();

        client.on('banner', (msg) => {
          bannerText = msg;
        });

        client.on('ready', () => {
          finish(true, `¡Conexión SSH exitosa con ${config.user}@${config.host}:${config.port || 22}!`);
        });

        client.on('error', (err: any) => {
          const detail = err.level === 'client-authentication'
            ? 'Error de autenticación SSH (usuario, contraseña o clave incorrectos).'
            : (err.message || String(err));
          finish(false, `Fallo al conectar por SSH: ${detail}`);
        });

        client.on('timeout', () => {
          finish(false, `Tiempo de espera agotado al conectar por SSH a ${config.host}:${config.port || 22}.`);
        });

        client.on('close', () => {
          if (!isResolved) {
            finish(false, 'La conexión SSH se cerró antes de completar la autenticación.');
          }
        });

        client.connect(sshOptions);
      } catch (err: any) {
        finish(false, err.message || 'Error al configurar la conexión SSH.');
      }
    });
  }

  /**
   * Crea un túnel SSH completo que escucha en un puerto local efímero (127.0.0.1:0)
   * y reenvía el tráfico hacia targetHost:targetPort a través del cliente SSH.
   */
  public async createTunnel(
    config: SshTunnelConfig,
    targetHost: string,
    targetPort: number
  ): Promise<ActiveSshTunnel> {
    const finalTargetHost = targetHost && targetHost.trim() ? targetHost.trim() : '127.0.0.1';
    const finalTargetPort = Number(targetPort) || 3306;

    const sshOptions = SshTunnelService.buildSshConnectConfig(config);

    // 1. Establecer conexión SSH
    const client = await new Promise<Client>((resolve, reject) => {
      const sshClient = new Client();
      let isReady = false;

      const onError = (err: any) => {
        if (!isReady) {
          const detail = err.level === 'client-authentication'
            ? 'Error de autenticación SSH (usuario, contraseña o clave incorrectos).'
            : (err.message || String(err));
          reject(new Error(`Túnel SSH fallido: ${detail}`));
        }
      };

      sshClient.once('error', onError);
      sshClient.once('timeout', () => {
        if (!isReady) {
          reject(new Error(`Tiempo de espera agotado al conectar al host SSH ${config.host}:${config.port || 22}.`));
        }
      });

      sshClient.once('ready', () => {
        isReady = true;
        sshClient.removeListener('error', onError);
        resolve(sshClient);
      });

      sshClient.connect(sshOptions);
    });

    // 2. Crear servidor TCP local en 127.0.0.1:0
    const activeSockets = new Set<net.Socket>();

    const localServer = net.createServer((socket) => {
      activeSockets.add(socket);

      const cleanupSocket = () => {
        activeSockets.delete(socket);
      };

      socket.once('close', cleanupSocket);
      socket.once('error', cleanupSocket);

      client.forwardOut(
        '127.0.0.1',
        socket.remotePort || 0,
        finalTargetHost,
        finalTargetPort,
        (err, stream) => {
          if (err) {
            console.error('Error forwarding stream over SSH:', err);
            socket.destroy(err);
            return;
          }

          // Error listeners
          stream.on('error', (streamErr: any) => {
            console.error('SSH stream error:', streamErr);
            socket.destroy(streamErr);
          });
          socket.on('error', (sockErr: any) => {
            console.error('Local proxy socket error:', sockErr);
            stream.destroy();
          });

          // Bidirectional pipe
          socket.pipe(stream).pipe(socket);
        }
      );
    });

    // Iniciar escucha en puerto aleatorio disponible
    await new Promise<void>((resolve, reject) => {
      localServer.once('error', reject);
      localServer.listen(0, '127.0.0.1', () => {
        localServer.removeListener('error', reject);
        resolve();
      });
    });

    const address = localServer.address() as net.AddressInfo;
    const localPort = address.port;

    // Manejar desconexión SSH imprevista
    client.on('error', (err) => {
      console.warn('SSH client error during active tunnel session:', err.message);
    });
    client.on('close', () => {
      for (const s of activeSockets) {
        try { s.destroy(); } catch {}
      }
      activeSockets.clear();
      try {
        localServer.close();
      } catch {}
    });

    const activeTunnel: ActiveSshTunnel = {
      localHost: '127.0.0.1',
      localPort,
      targetHost: finalTargetHost,
      targetPort: finalTargetPort,
      close: async () => {
        // Destruir sockets activos
        for (const s of activeSockets) {
          try {
            s.destroy();
          } catch {}
        }
        activeSockets.clear();

        // Cerrar servidor local
        await new Promise<void>((res) => {
          localServer.close(() => res());
        });

        // Terminar conexión SSH
        try {
          client.end();
        } catch {}
      }
    };

    return activeTunnel;
  }
}
