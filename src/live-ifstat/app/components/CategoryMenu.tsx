'use client'

import { useState } from 'react'
import { CATEGORIES, ComponentCategory } from '@/types/dashboard'

interface CategoryMenuProps {
  currentCategory: ComponentCategory;
  onCategoryChange: (category: ComponentCategory) => void;
  customLayoutNames: Record<string, string>;
  onCustomNameChange: (id: string, name: string) => void;
  isEditMode: boolean;
}

export const CategoryMenu = ({ 
  currentCategory, 
  onCategoryChange,
  customLayoutNames,
  onCustomNameChange,
  isEditMode 
}: CategoryMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-[10px] left-[15px] z-50 p-1 bg-gray-100 dark:bg-gray-800 rounded-none hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          strokeWidth="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" stroke="#ff0000"></line>
          <line x1="3" y1="12" x2="21" y2="12" stroke="#cc0000"></line>
          <line x1="3" y1="18" x2="21" y2="18" stroke="#990000"></line>
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-16 left-4 z-50 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            {CATEGORIES.map((category) => (
              <div 
                key={category.id} 
                className="flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => {
                  onCategoryChange(category.id);
                  setIsOpen(false);
                }}
              >
                <div className={`flex-grow px-4 py-2 text-gray-900 dark:text-gray-100
                  ${currentCategory === category.id ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
                >
                  {category.id.startsWith('custom_') ? (
                    isEditMode ? (
                      <input
                        value={customLayoutNames[category.id]}
                        onChange={(e) => {
                          e.stopPropagation();
                          onCustomNameChange(category.id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-gray-900 dark:text-white focus:outline-none bg-gray-100 dark:bg-gray-800"
                        spellCheck="false"
                      />
                    ) : (
                      customLayoutNames[category.id]
                    )
                  ) : (
                    category.label
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}; 