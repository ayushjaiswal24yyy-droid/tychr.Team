import 'socket.io';

declare module 'socket.io' {
  interface Socket {
    user: {
      id: number;
      username: string;
      email: string;
    };
  }
}