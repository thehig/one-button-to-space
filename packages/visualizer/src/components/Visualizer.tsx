import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "./Visualizer.module.css";
// Example import to verify monorepo linkage
// Remove or replace with real usage later
import { PhysicsEngine } from "@obts/shared/physics/PhysicsEngine";

const CANVAS_ID = "canvas";
const CARD_PREFIX = "card-";
const CARD_COUNT = 12; // Example: 12 cards for demo

// Placeholder VisualizationCanvas
const VisualizationCanvas: React.FC = () => (
  <div className={styles.canvas}>
    <span>800x600 Canvas</span>
  </div>
);

// Sortable Card wrapper for dnd-kit
const SortableCard: React.FC<{
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}> = ({ id, title, collapsed, onToggle }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 2 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={styles.cardCell}
    >
      <Card id={id} title={title} collapsed={collapsed} onToggle={onToggle} />
    </div>
  );
};

// Collapsible Card
const Card: React.FC<{
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}> = ({ id, title, collapsed, onToggle }) => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <span>{title}</span>
      <button
        onClick={onToggle}
        className={styles.collapseBtn}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? "▸" : "▾"}
      </button>
      {/* Icon button placeholder */}
      <button className={styles.iconBtn} title="Action">
        ★
      </button>
    </div>
    {!collapsed && (
      <div className={styles.cardContent}>Card content for {title}</div>
    )}
  </div>
);

// Helper to get/restore order from localStorage
const getInitialOrder = (): string[] => {
  const stored = localStorage.getItem("visualizerCardOrder");
  if (stored) return JSON.parse(stored);
  // Default: canvas first, then cards
  return [
    CANVAS_ID,
    ...Array.from({ length: CARD_COUNT }, (_, i) => `${CARD_PREFIX}${i + 1}`),
  ];
};

const Visualizer: React.FC = () => {
  const [order, setOrder] = useState<string[]>(getInitialOrder());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    localStorage.setItem("visualizerCardOrder", JSON.stringify(order));
  }, [order]);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Only allow reordering of cards, not the canvas
    if (active.id === CANVAS_ID || over.id === CANVAS_ID) return;
    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  const handleToggle = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Just to verify import works
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      "PhysicsEngine from @obts/shared:",
      PhysicsEngine ? "OK" : "NOT FOUND"
    );
  }, []);

  return (
    <div className={styles.gridWrapper}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={order.filter((id) => id !== CANVAS_ID)}
          strategy={rectSortingStrategy}
        >
          <div className={styles.grid}>
            {/* Render the canvas in a fixed spot */}
            <div
              key={CANVAS_ID}
              className={styles.canvasCell}
              style={{ gridColumn: "span 2" }}
            >
              <VisualizationCanvas />
            </div>
            {/* Render cards */}
            {order
              .filter((id) => id !== CANVAS_ID)
              .map((id) => (
                <SortableCard
                  key={id}
                  id={id}
                  title={`Card ${id.replace(CARD_PREFIX, "")}`}
                  collapsed={!!collapsed[id]}
                  onToggle={() => handleToggle(id)}
                />
              ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default Visualizer;
