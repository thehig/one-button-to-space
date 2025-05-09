I am going to outline a system architecture that we are in the process of building.

We are building a game framework which we will use to build HTML5 games.

Games will be 2d physics based. They will work in a client standalone fashion, or in a multiplayer setting using parallel simulation with authoratitive server state updates.

Project Structure:

- Expect heavy usage of AI agents, so standards, personas and diciplines are essential for quality
- pnpm monorepo structure, using a `packages` directory
- vite, vitest, vitest-ui, typescript used in all packages
- pnpm scripts in every individual package (build, test, dev, lint)

Work will be done on only one 'module' at a time. Expected modules are:

- logger-ui (already completed)
  - Contains a UI element that will recieve Phaser Events and display them in a useful onscreen way.
  - Inclusion should be done as soon as possible
- physics-worker (in progress)
  - Contains all the code needed to run the physics engine
  - Completely deterministic and requires no specific renderer
  - Powered by Matter.js physics library
  - Will be run simultaneously in server (optional) and in client
  - Will be used by the browser-client in a 'web-worker' to execute physics engine in a separate thread
  - Will support a further sub-thread for 'prediction' engine, which will take an efficient copy of the state and execute a number of updates/seconds into the future for predictive purposes. This will be async with the predictions arriving when they are calculated
  - Will recieve commands from a companion client which will send commands, track updates and otherwise maintain state in a performant fashion between the physics worker and the browser client
  - Will be used by the server to execute the authoratitive world state, which will periodically update the clients workers with the authoratitive state
- game-manager
  - Will render the React Components of the game
  - Will contain a scene manager which extends/utilises Phaser.js' Scene mechanics.
  - Will contain a boot scene, a menu, an options scene and a game scene
  - Will not contain any game specific code. This is all about the 'shell' of the game engine, not the specific game elements themselves
- browser-client
  - Will be the intended play experience, on mobile handset and on desktop
  - Controls will apply to a simple spacecraft with only one active control (thruster) and 1 control axis (either left/right keys on keyboard, align/rotate to face mouse pointer, or tile physical handset using device orientation to always have the spacecraft always point toward real-world 'up')
- server
  - Will contain world definitions for multiplayer worlds
  - Will maintain game state between sessions
  - Will simulate physics engine and handle the game/world events
  - Will run the multiplayer server framework for client join, leave, rooms etc
- shared
  - Will contain the data type definitions, the action definitions, and any other shared code that is used both in client and in server, or when communicating between client and server.

Workflow will be:

- Very heavily focused on Test Driven Development. We will generate a cursor rule to enforce this.
- Rely on regular user testing and feedback
- Using git version control to commit at regular intervals
- Focus on one thing at a time, waiting until the user is happy before moving on

System Heirarchy
