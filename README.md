# Timer

Timer is a local-first time-tracking app featuring custom settings and labels

## Development

| Command                | Description                                                                      |
|------------------------|----------------------------------------------------------------------------------|
| `npm start`            | Execute the app in the web browser in dev mode                                   |
| `npm run tauri:serve`  | Launch the native desktop application in development mode with hot-reloading     |
| `npm run tauri:bundle` | Build the application and create an executable app based on the operating system |

## Build docker container

Build the project:

```bash
npm run build
```

Build the Docker image:

```bash
docker build -t timer-angular:latest .
```

Run the container:

```bash
docker run -d -p 8081:80 --name timer-angular timer-angular:latest
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
