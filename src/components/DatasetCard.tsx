export default function DatasetCard({name,size}:any){
  return(
    <div className="dataset-card">

      <div>
        <h3>{name}</h3>
        <p>AI Dataset</p>
      </div>

      <div>
        <p>{size}</p>
        <span className="badge">Verified</span>
      </div>

    </div>
  )
}