export default function Navbar() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">

      <h2 className="text-xl font-semibold">
        Dashboard
      </h2>

      <input
        type="text"
        placeholder="Search..."
        className="border border-pink-200 px-3 py-2 rounded-lg"
      />

    </div>
  )
}