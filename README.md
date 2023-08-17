# Janus Docker

Setup your own janus server locally or on production environment hassle free. this repo contains both `Dockerfile` and `docker-compose.yaml` for building as well as deployment of janus server.

# Recommended way

Use `Janus` folder to build or deploy janus gateway using docker-compose
it uses pre-build core image which comes with pre-installed janus gateway dependencies cuts down lot of compile time since nobody's got time to compile and wait for hours
you can find `JanusCoreDeps` docker image [here](https://hub.docker.com/repository/docker/shivanshtalwar0/januscoredeps/tags)
or can build your own if you got lot of time in this world. by using [JanusCoreDeps](./JanusCoreDeps/) folder it outputs docker image containing just janus peer dependencies

# QuickStart

### Env file

First of all Copy gcp key into `converter` folder,
In janus folder you will find `.env` file which in which you can specify .

```bash
URI_CONV_ENDPOINT=<endpoint to decypt sip uri to make the call used by janus>
URI_CONV_AUTH_TOKEN=<utt external user token with required privileges>
RECORDING_UPLOAD_ENDPOINT=<endpoint where you want to upload the recording once ready>
GCP_AUTH_KEY_FILE='key.json' # must be placed in converter directory
GCS_BUCKET='uticen-recording-testing'
```

after we process recording with the help of converter we upload it directly to google cloud bucket specified by `GCS_BUCKET`
as is like `<callId>.wav`

### Run containers

```bash
cd Janus
docker-compose up --build -d # note option -d to start it in detached mode
```

# Build

    cd Janus
    docker build -t dockerusername/janusgateway:latest .
    docker run -d dockerusername/janusgateway:latest

# volume in docker-compose

we have mounted /recordings as a volume so that we can do any post-processing on them for example converting them to single wav file from two mjr files using converter.py

# Recording Conversion using converter

In janus folder you will find `converter` directory , which is basically a express server offering janus-event-handler webhook.
inside the docker, `converter` container shares recordings volume with `janus` container so whenever there is new recording to be processed it converts it into `<callId>.wav` file and uploads the file to uticen endpoint of our choice with external user token associated to it. followed by removal of recording from shared `recordings` volume.
Same idea can be extended to kubernetes in which janus pod and converter pod shares a common volume and communicate together as a single unit to make the recording file processing seamless
