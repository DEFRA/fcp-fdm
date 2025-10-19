![Build](https://github.com/defra/fcp-fdm/actions/workflows/publish.yml/badge.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=bugs)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)

# Farming Data Model (FDM)

The Farming Data Model service is a common component to support data exchange between the various
Farming and Countryside Programme (FCP) services.

## Requirements

### Docker

This application is intended to be run in a Docker container to ensure consistency across environments.

Docker can be installed from [Docker's official website](https://docs.docker.com/get-docker/).

> The test suite includes integration tests which are dependent on a Postgres container so cannot be run without Docker.

## Local development

### Setup

Install application dependencies:

```bash
npm install
```

### Development

To run the application in `development` mode run:

```bash
npm run docker:dev
```

### Testing

To test the application run:

```bash
npm run docker:test
```

Tests can also be run in watch mode to support Test Driven Development (TDD):

```bash
npm run docker:test:watch
```

## SQS events

The Farming Data Model service consumes events from an AWS SQS queue.

### Sending test events

To support local development, a Node.js script has been provided to send test events to the SQS queue based on predefined scenarios.

To send a single event, run the following command, replacing `single.messageRequest` with the desired scenario name:

```bash
node ./scripts/send-event.js single.messageRequest
```

To list the available event scenarios, run:

```bash
node ./scripts/send-event.js
```

## API endpoints

Data collected by the Farming Data Model service can be accessed via the following API endpoints:

| Endpoint                                               | Method | Description                                      |
| :----------------------------------------------------- | :----- | :----------------------------------------------- |
| `GET: /health`                                         | GET    | Health check endpoint                            |

All these endpoints are documented using [hapi-swagger](https://www.npmjs.com/package/hapi-swagger).

Documentation for the API can be found at [http://localhost:3000/documentation](http://localhost:3000/documentation) when running the application in development mode.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
