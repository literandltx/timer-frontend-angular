# Timer

Timer is a local-first time-tracking app featuring custom settings and labels

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
