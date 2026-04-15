#!/usr/bin/env node
import path from "node:path";
import { startHackingtoolServer } from "./server.js";

const dataDir = path.resolve(process.cwd(), process.env.GITGOD_DATA_DIR ?? "./data");
startHackingtoolServer(dataDir);
