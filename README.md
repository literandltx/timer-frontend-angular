# Timer Angular

A modern timer application built with Angular. This project provides a robust frontend for managing timers, history, and labels with features like authentication and offline synchronization.

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
