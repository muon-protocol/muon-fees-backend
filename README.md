# MUON fees backend

This project manages the fee computations for requests on the MUON network. 

## Installation

First, run npm i to install the project's dependencies.
Make a copy of the `.env.example` file and rename it to `.env`.

In the `.env` file,
Set the MongoDB connection in the `MONGODB_CS` variable and establish the appropriate Redis connection by providing the `REDIS_URL`. 

Then place the signer's private key in the `SIGNER_PK` field and its corresponding public key in the `SIGNER` field.



Inside the MUON node's global configuration file, located at `config/global/default.net.conf.json`, there's an object dedicated to the fee server configuration:

```
"fee": {
    "endpoint": "__URL_TO_FEE_SERVER__",
    "signers": [
      "__SIGNER_PUBLIC_KEY__"
    ]
},
```
The address for the fee server instance needs to be set within this object, and the same signer's public key must also be added here.

##Running fee server
You can initiate this project by executing the `npm start` command.
 