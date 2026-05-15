import { BrowserRouter, Routes, Route } from 'react-router-dom'
import InviteGate from './components/InviteGate'
import Home from './pages/Home'
import Apply from './pages/Apply'
import Success from './pages/Success'

export default function App() {
  return (
    <InviteGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/success" element={<Success />} />
        </Routes>
      </BrowserRouter>
    </InviteGate>
  )
}
