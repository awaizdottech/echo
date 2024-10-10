import { BlobServiceClient } from "@azure/storage-blob";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const blobServiceClient = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/?${process.env.AZURE_SAS_TOKEN}`
);

const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_CONTAINER_NAME
);

async function uploadImage(blobName, localFilePath) {
  const blobClient = containerClient.getBlockBlobClient(blobName);

  await blobClient.uploadFile(localFilePath);

  return blobClient.url;
}

const uploadOnCloud = async (localFilePath, blobName) => {
  try {
    if (!localFilePath) return null;
    // upload On Azure
    const azureResponse = await uploadImage(blobName, localFilePath);
    fs.unlinkSync(localFilePath);
    return azureResponse;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    return null;
  }
};

async function deleteFromCloud(blobName) {
  // include: Delete the base blob and all of its snapshots.
  // only: Delete only the blob's snapshots and not the blob itself.
  const options = {
    deleteSnapshots: "include", // or 'only'
  };

  // Create blob client from container client
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const result = await blockBlobClient.deleteIfExists(options);

  if (result.succeeded) {
    console.log(`Blob ${blobName} deleted successfully`);
  } else {
    console.log(`Blob ${blobName} does not exist`);
  }
}

export { uploadOnCloud, deleteFromCloud };

// // do something with containerClient...
// let i = 1;

// // List blobs in container
// for await (const blob of containerClient.listBlobsFlat()) {
//   console.log(`Blob ${i++}: ${blob.name}`);
// }
// // do something with blobClient...
// const properties = await blobClient.getProperties();
// console.log(`Blob ${blobName} properties:`);

// // get BlockBlobClient from blobClient
// const blockBlobClient = blobClient.getBlockBlobClient();

// // do something with blockBlobClient...
// const downloadResponse = await blockBlobClient.download(0);
