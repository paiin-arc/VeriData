export type Dataset = {
  name: string
  size: string
  blobId?: string
  txHash?: string
}

let datasets: Dataset[] = []

export function addDataset(dataset: Dataset) {
  datasets.unshift(dataset)
}

export function getDatasets() {
  return datasets
}