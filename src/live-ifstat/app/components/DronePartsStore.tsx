'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Part } from '@/types/part';
import Cart from './Cart';
import { useCart } from '../context/CartContext';

async function getParts(): Promise<Part[]> {
  const res = await fetch('http://localhost:3000/api/parts');
  return res.json();
}

export default function DronePartsStore() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { state, dispatch } = useCart();
  const [parts, setParts] = useState<Part[]>([]);

  useEffect(() => {
    const loadParts = async () => {
      const fetchedParts = await getParts();
      setParts(fetchedParts);
    };
    loadParts();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Drone Parts Store</h2>
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600"
        >
          <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          {state.items.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {state.items.length}
            </span>
          )}
        </button>
      </div>

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      <div className="overflow-y-auto max-h-[calc(100vh-16rem)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {parts.map((part) => (
            <div key={part.id} className="bg-gray-50 rounded-lg overflow-hidden shadow">
              <div className="relative h-32 w-full">
                <Image
                  src={part.image_url || '/placeholder-drone-part.jpg'}
                  alt={part.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">{part.name}</h3>
                <p className="text-gray-600 text-sm mb-2 line-clamp-2">{part.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-600">${part.price}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    part.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {part.stock > 0 ? `${part.stock} in stock` : 'Out of stock'}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button 
                    onClick={() => dispatch({ type: 'ADD_ITEM', payload: part })}
                    className="flex-1 bg-blue-600 text-white py-1 px-2 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    Add to Cart
                  </button>
                  <Link 
                    href={`/parts/${part.id}`}
                    className="flex-1 bg-gray-600 text-white py-1 px-2 rounded text-sm hover:bg-gray-700 transition-colors text-center"
                  >
                    Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 