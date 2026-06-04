import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './app/globals.css'

// Lazy-load pages for code splitting
const HomePage = React.lazy(() => import('./app/page'))
const RestaurantPage = React.lazy(() => import('./app/[restaurant]/page'))
const MyOrdersPage = React.lazy(() => import('./app/my-orders/page'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <React.Suspense fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-white/50 animate-pulse">載入中...</div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/my-orders" element={<MyOrdersPage />} />
          <Route path="/:restaurant" element={<RestaurantPage />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  </React.StrictMode>
)
