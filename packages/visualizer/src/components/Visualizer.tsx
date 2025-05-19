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
import { ScenarioSelector } from "./ScenarioSelector";
import { SimulationControls } from "./SimulationControls";
import { CameraControls } from "./CameraControls";
import { InfoPanel } from "./InfoPanel";
import { scenarioCardLayout, DEFAULT_CARDS } from "../scenarioCards";
import type { ScenarioCardDef } from "../scenarioCards";
import { useScenario } from "../hooks/useScenario";
import { ALL_SCENARIOS } from "../scenarioLoader";

const CANVAS_ID = "canvas";
const CARD_PREFIX = "card-";
const CARD_COUNT = 12; // Example: 12 cards for demo

const SCENARIO_OPTIONS = ["default", "gravity", "collision", "orbits"];
const MOCK_INFO = { objects: 12, time: 3.2, status: "running" };

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
  children?: React.ReactNode;
}> = ({ id, title, collapsed, onToggle, children }) => {
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
      <Card id={id} title={title} collapsed={collapsed} onToggle={onToggle}>
        {children}
      </Card>
    </div>
  );
};

// Collapsible Card
const Card: React.FC<{
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ id, title, collapsed, onToggle, children }) => (
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
    {!collapsed && <div className={styles.cardContent}>{children}</div>}
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
  const { scenario } = useScenario();
  const cardDefs: ScenarioCardDef[] =
    scenarioCardLayout[scenario] || DEFAULT_CARDS;

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

  // Helper to render card content by type
  const renderCardContent = (card: ScenarioCardDef) => {
    switch (card.type) {
      case "scenarioSelector":
        return <ScenarioSelector options={ALL_SCENARIOS} />;
      case "simulationControls":
        return <SimulationControls />;
      case "cameraControls":
        return <CameraControls />;
      case "infoPanel":
        return <InfoPanel {...(card.props || {})} />;
      default:
        return <div>Custom/Unknown card: {card.title}</div>;
    }
  };

  // Always render the scenario picker as the first card
  const scenarioPickerCard: ScenarioCardDef = {
    id: "selector",
    type: "scenarioSelector",
    title: "Scenario",
  };

  return (
    <div className={styles.gridWrapper}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={[scenarioPickerCard.id, ...cardDefs.map((c) => c.id)]}
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
            {/* Always render scenario picker first */}
            <SortableCard
              key={scenarioPickerCard.id}
              id={scenarioPickerCard.id}
              title={scenarioPickerCard.title}
              collapsed={!!collapsed[scenarioPickerCard.id]}
              onToggle={() => handleToggle(scenarioPickerCard.id)}
            >
              {renderCardContent(scenarioPickerCard)}
            </SortableCard>
            {/* Render scenario-driven cards */}
            {cardDefs.map((card) => (
              <SortableCard
                key={card.id}
                id={card.id}
                title={card.title}
                collapsed={!!collapsed[card.id]}
                onToggle={() => handleToggle(card.id)}
              >
                {renderCardContent(card)}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default Visualizer;
