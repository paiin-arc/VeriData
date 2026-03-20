# VeriData

VeriData is a decentralized application that allows developers to upload AI datasets to Shelby decentralized blob storage and optionally register intellectual property using the Story Protocol. This application leverages the Aptos blockchain infrastructure to ensure secure and efficient interactions.

## Features

- **Decentralized Storage**: Upload and manage AI datasets using Shelby's decentralized blob storage.
- **Intellectual Property Registration**: Register datasets as intellectual property through the Story Protocol.
- **Blockchain Integration**: Utilize the Aptos blockchain for secure transactions and interactions.

## Project Structure

```
veridata
├── src
│   ├── lib
│   │   ├── client.ts
│   │   ├── shelby.ts
│   │   ├── story-protocol.ts
│   │   └── aptos.ts
│   ├── services
│   │   ├── dataset-upload.ts
│   │   ├── ip-registration.ts
│   │   └── storage.ts
│   ├── controllers
│   │   ├── upload.ts
│   │   └── ip.ts
│   ├── types
│   │   ├── dataset.ts
│   │   ├── index.ts
│   │   └── storage.ts
│   ├── utils
│   │   ├── validators.ts
│   │   └── helpers.ts
│   ├── config
│   │   └── networks.ts
│   └── app.ts
├── tests
│   ├── unit
│   └── integration
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd veridata
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Copy the `.env.example` file to `.env` and fill in the required values.

## Usage

To start the application, run:
```
npm start
```

This will launch the server and expose the API endpoints for uploading datasets and registering intellectual property.

## API Endpoints

- **Upload Dataset**: `POST /api/upload`
- **Register Intellectual Property**: `POST /api/ip`

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.