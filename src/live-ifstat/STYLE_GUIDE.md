# DarkFlows UI Style Guide

## Components

### Dialog Structure
- Background: bg-gray-50 dark:bg-gray-800
- Text color: text-gray-900 dark:text-gray-100
- Border radius: rounded-lg
- Title section: border-b border-gray-200 dark:border-gray-700 px-6 py-2
- Content padding: !p-6
- Actions section: p-6 border-t border-gray-800
  - Cancel button: bg-blue-500 dark:bg-blue-600 text-white
  - Save button: bg-green-500 dark:bg-green-600 text-white
  - Button hover: hover:bg-[color]-600 dark:hover:bg-[color]-700

### Form Elements

#### Labels
- Font size: text-[10px]
- Font weight: font-medium
- Colors: text-gray-700 dark:text-gray-300
- Width: w-[85px]

#### Text/Number Inputs
- Width: w-[120px]
- Padding: px-1.5 py-1
- Font size: text-[10px]
- Background: bg-gray-50 dark:bg-gray-700
- Border: border border-gray-300 dark:border-gray-600
- Text color: text-gray-900 dark:text-gray-100
- Focus: focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400
- Border radius: rounded

#### Select/Dropdown (MUI)
- Base styling matches inputs
- Height: 24px
- Select text padding: 1px 6px
- Menu background: bg-gray-50 dark:bg-gray-700
- Text color: text-gray-900 dark:text-gray-100
- Menu item hover (light): bg-gray-100
- Menu item selected (light): bg-blue-600 text-white
- Menu item selected hover (light): bg-blue-700
- Menu item hover (dark): bg-gray-600
- Menu item selected (dark): bg-blue-600 text-white
- Menu item selected hover (dark): bg-blue-700
- Font size: text-[10px]
- Menu item padding: 4px 8px

#### Checkbox
- Label styling matches other labels
- Margin right: mr-2

### Buttons

#### Primary (Blue)
- Height: h-6
- Padding: px-2 py-0.5
- Background: bg-blue-500 dark:bg-blue-600
- Hover: hover:bg-blue-600 dark:hover:bg-blue-700
- Focus: focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400
- Text: text-white text-xs font-medium
- Disabled: opacity-50 cursor-not-allowed

### Layout

#### Two-Column Form
- Flex container with gap-8
- Column width: w-[205px]
- Vertical spacing: space-y-2
- Items aligned center: items-center

### Error States
- Background: bg-red-100
- Border: border border-red-400
- Text: text-red-700
- Font size: text-xs
- Padding: px-2 py-1
- Border radius: rounded
- Margin bottom: mb-2

### Tables
- Full width: w-full
- Header background: bg-gray-50 dark:bg-gray-700
- Header text: text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider
- Cell padding: px-2 py-1
- Cell text: text-xs text-gray-700 dark:text-gray-300
- Alternating rows: card-alternate (bg-gray-50 dark:bg-gray-700)
- Row hover: card-hover (hover:bg-gray-100 dark:hover:bg-gray-600)
- Sticky header: sticky top-0 z-10

### Card Layout
- Padding: p-3
- Shadow: shadow-sm
- Border radius: rounded-lg
- Flex layout: flex flex-col
- Full height: h-full

#### Error Messages
- Font size: text-[9px]
- Color: text-red-500
- Margin top: mt-0.5



