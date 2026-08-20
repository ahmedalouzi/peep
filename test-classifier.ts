import { classifyRequest } from './packages/agent/src/planning/classifier';
import { ProjectPlanner } from './packages/agent/src/planning/planner';
import { runAgentLoop } from './packages/agent/src/orchestrator';

async function test() {
  console.log("Testing classifyRequest:");
  const msgs = [
    "Can you work with Flutter?",
    "What projects do you recommend?",
    "What is React Native?",
    "Hello",
    "Can you build this using Flutter?",
    "Create a Flutter project",
    "Inspect my project",
    "Create a component"
  ];
  for (const m of msgs) {
    console.log(`"${m}" ->`, classifyRequest(m));
  }
}
test();
