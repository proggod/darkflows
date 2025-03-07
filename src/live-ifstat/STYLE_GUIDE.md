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

#### Base Card Structure
- **Outer Container**
  ```jsx
  <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
    <div className="flex flex-col h-full">
      {/* Card content */}
    </div>
  </div>
  ```
- Double nested flex-col divs for proper height handling
- No explicit background color (handled by parent container)

#### Card Header
- Title: `<h3 className="text-label mb-2">Card Title</h3>`
- Actions row (if needed):
  ```jsx
  <div className="flex items-center justify-between mb-2 px-1">
    <div className="flex items-center gap-2">
      {/* Buttons */}
    </div>
  </div>
  ```

#### Card Content
- Main content wrapper: `<div className="flex-1 overflow-auto">`
- Form layout: `<div className="grid gap-2">`
- Form groups: `<div className="flex items-center gap-1">`

#### Form Elements

##### Labels
- Font size: text-[10px]
- Font weight: font-medium
- Colors: text-gray-700 dark:text-gray-300
- Width: w-[85px]

##### Text/Number Inputs
- Width: w-full min-w-[120px]
- Padding: px-1.5 py-1
- Font size: text-[10px]
- Background: bg-gray-50 dark:bg-gray-700
- Border: border border-gray-300 dark:border-gray-600
- Text color: text-gray-900 dark:text-gray-100
- Focus: focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400
- Border radius: rounded

##### Buttons
- Primary (Blue):
  ```jsx
  className="px-2 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium 
    hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 
    focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 
    disabled:cursor-not-allowed transition-colors flex items-center gap-1"
  ```
- Save (Green): Same as Primary but with green colors

#### Error States
```jsx
<div className="mt-2 p-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
  <p className="text-[10px] text-red-800 dark:text-red-200">{error}</p>
</div>
```

#### Implementation Example
```jsx
export function ExampleCard() {
  return (
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <h3 className="text-label mb-2">Card Title</h3>
        
        {/* Actions Row */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <button className="...">Save</button>
            <button className="...">Refresh</button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">
                Label
              </label>
              <input className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 
                border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 
                focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full min-w-[120px]" 
              />
            </div>
          </div>
        </div>
        
        {/* Error State */}
        {error && (
          <div className="mt-2 p-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
            <p className="text-[10px] text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Component Sizing

#### Standard Card
- Default size: Single width, single height
- Grid classes: Not needed (parent will handle)
- Height: `h-full flex flex-col`
- Content container: `flex-1 overflow-auto min-h-0`
- **Background color:** `bg-black/30 dark:bg-gray-800/30 backdrop-blur-sm` (semi-transparent with blur)

#### Double Height Card
- When a component requires more vertical space
- **Important**: The parent component (page.tsx) must provide the `row-span-2` class
- The component itself should:
  - Set correct height with `h-full flex flex-col`
  - Include overflow handling: `overflow-auto min-h-0`
  - Use proper spacing: `space-y-3` (not too compact, not too sparse)
  - Use appropriate text sizes for content: Use `text-[9px]` or `text-[10px]` for content
  - Use appropriate vertical padding: `p-3` for container, `p-1.5` for items
  - Use standard margins: `mb-2` or `mb-3` between sections
  - **Background color must match:** `bg-black/30 dark:bg-gray-800/30 backdrop-blur-sm`

#### Double Width Card
- When a component requires more horizontal space
- **Important**: The parent component (page.tsx) must provide the `col-span-2` class
- The component itself should:
  - Use horizontal layouts where possible
  - Ensure input widths are appropriate
  - **Background color must match:** `bg-black/30 dark:bg-gray-800/30 backdrop-blur-sm`

#### Double Width and Height Card
- For complex components requiring more space
- **Important**: The parent component (page.tsx) must provide both `row-span-2 col-span-2` classes
- Combine the guidelines from both Double Height and Double Width
- **Background color must match:** `bg-black/30 dark:bg-gray-800/30 backdrop-blur-sm`

#### Implementation Instructions

1. **Modify Component Size in Parent Layout (CRITICAL STEP)**
   - File to edit: `app/page.tsx`
   - Find the SortableItem className conditional (around line 630):
   ```jsx
   <SortableItem 
     key={id} 
     id={id} 
     isEditMode={isEditMode}
     className={
       id === 'reservations' || id === 'leases' || id === 'weather' || id === 'processes' || 
       id === 'sambaShares' || id === 'dnsClients' || id === 'CustomDNSLists' || id === 'bandwidth' || 
       id === 'systemSettings' || id === 'blockClients' || id === 'wifiSettings'
         ? 'row-span-2 col-span-2'
         : id === 'clock' || id === 'interfaceStatus'
         ? 'row-span-1 col-span-1'
         : 'row-span-1 col-span-2'
     }
   >
   ```
   - Add your component ID to the appropriate condition:
     - For double height and width: Add to the first group (with 'row-span-2 col-span-2')
     - For single height and width: Add to the second group (with 'row-span-1 col-span-1')
     - For single height, double width: It will default to the third option

2. **Update the Component's Internal Structure**
   - For double height components, ensure proper content handling:
   ```jsx
   <div className="rounded-lg shadow-sm p-3 flex flex-col h-full bg-black/30 dark:bg-gray-800/30 backdrop-blur-sm">
     <h3 className="text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Component Title</h3>
     
     {/* Actions row */}
     <div className="flex items-center justify-between mb-3">
       {/* Buttons */}
     </div>
     
     {/* Main content - notice the overflow handling */}
     <div className="flex-1 overflow-auto min-h-0 space-y-3">
       {/* Content */}
     </div>
   </div>
   ```

#### Common Mistakes and Solutions

1. **Component Not Double Height**
   - **Problem**: Component looks too short compared to other double-height components
   - **Solution**: 
     - Check `app/page.tsx` and ensure your component ID is added to the list that gets `row-span-2 col-span-2`
     - This is the most common mistake - components cannot set their own grid span!

2. **Background Color Mismatch**
   - **Problem**: Component background color doesn't match others in the dashboard
   - **Solution**: 
     - Use `bg-black/30 dark:bg-gray-800/30 backdrop-blur-sm` instead of solid colors
     - The semi-transparent background with backdrop blur creates the frosted glass effect

3. **Content Overflow**
   - **Problem**: Content is cut off or causes scrolling
   - **Solution**:
     - Ensure the main content container has `flex-1 overflow-auto min-h-0`
     - For grid layouts of items, limit the number of items or use responsive grids

#### Examples

**For Double Height Card:**
```jsx
// In page.tsx, add to the row-span-2 col-span-2 condition
id === 'reservations' || ... || 'yourComponentId'
  ? 'row-span-2 col-span-2'

// In your component file
<div className="rounded-lg shadow-sm p-3 flex flex-col h-full bg-gray-50 dark:bg-gray-800">
  {/* Component content with overflow-auto */}
</div>
```

**For Single Height Card:**
```jsx
// In page.tsx, add to the row-span-1 col-span-1 condition
id === 'clock' || ... || 'yourComponentId'
  ? 'row-span-1 col-span-1'

// In your component file - same structure but less content
<div className="rounded-lg shadow-sm p-3 flex flex-col h-full bg-gray-50 dark:bg-gray-800">
  {/* Component content with overflow-auto */}
</div>
```



