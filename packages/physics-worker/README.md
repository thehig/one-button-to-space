# @one-button-to-space/physics-worker

## Overview

This package provides a physics engine running in a Web Worker, designed to offload physics calculations from the main thread. It uses Matter.js for the physics simulation and communicates with the main thread using a command-based pattern.

## Features

- Physics calculations (Matter.js) in a separate Web Worker.
- Command-based API for interacting with the physics worker.
- (Other features to be listed as developed)

## Installation

(Instructions on how to install or integrate this package, likely related to pnpm workspace usage)

```bash
pnpm add @one-button-to-space/physics-worker
```

## Usage

(Basic examples of how to initialize and use the physics worker)

```typescript
// Example:
// import { PhysicsWorkerClient } from '@one-button-to-space/physics-worker';
//
// const physics = new PhysicsWorkerClient();
// physics.sendCommand({ type: 'INIT_WORLD', payload: { width: 800, height: 600 } });
```

## API

(Detailed API documentation, focusing on the Command objects and their payloads/responses will go here or be linked from here)

### Commands

- `INIT_WORLD`: Initializes the physics world.
  - Payload: `{ width: number, height: number, gravity?: { x: number, y: number, scale: number } }`
- (More commands to be documented)

### Events/Responses

- (Events or response messages from the worker to be documented)

## Development

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

## Contributing

(Guidelines for contributing to this package)
