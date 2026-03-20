import express from 'express';
import bodyParser from 'body-parser';
import uploadController from './controllers/upload';
import ipController from './controllers/ip';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/upload', uploadController);
app.use('/api/ip', ipController);

app.listen(PORT, () => {
  console.log(`VeriData server is running on port ${PORT}`);
});