import { Link } from 'react-router-dom'

export default function PlaceholderPage({ title }) {
  return (
    <div className="placeholder-page">
      <Link to="/">← Home</Link>
      <h1>{title}</h1>
      <p>Coming soon.</p>
    </div>
  )
}
