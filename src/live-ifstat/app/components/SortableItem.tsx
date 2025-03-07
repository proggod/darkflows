import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  id: string;
  children: React.ReactNode;
  isEditMode: boolean;
  className?: string;
}

export function SortableItem({ id, children, isEditMode, className = '' }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    height: '100%',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'z-10' : ''} ${className}`}
    >
      <div className="absolute inset-0 card-bg backdrop-blur-sm">
        <div className="h-full p-4">
          {isEditMode && (
            <div
              {...attributes}
              {...listeners}
              className="absolute top-2 right-2 z-20 p-1 cursor-grab active:cursor-grabbing btn-gray rounded-full"
              title="Drag to reorder"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 dark:text-gray-300">
                <circle cx="9" cy="12" r="1" />
                <circle cx="9" cy="5" r="1" />
                <circle cx="9" cy="19" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="15" cy="5" r="1" />
                <circle cx="15" cy="19" r="1" />
              </svg>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
} 