/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to use Colyseus Cloud
 *
 * If you're self-hosting (without Colyseus Cloud), you can manually instantiate a
 * Colyseus Server as documented here: 👉 https://docs.colyseus.io/server/api/#constructor-options
 */
import { listen } from "@colyseus/tools";
import {
  SHARED_TEST_CONSTANT,
  testSharedFunction,
} from "../../shared/src/index";

// Import arena config
import appConfig from "./app.config";

// Create and listen on 2567 (or PORT environment variable.)
listen(appConfig);
