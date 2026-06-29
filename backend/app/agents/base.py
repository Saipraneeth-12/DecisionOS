"""
Base Agent class for DecisionOS
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import time
from app.core.logging import logger


class AgentResult:
    def __init__(
        self,
        agent_name: str,
        status: str = "completed",
        output: Dict[str, Any] = None,
        error: Optional[str] = None,
        latency_ms: int = 0,
    ):
        self.agent_name = agent_name
        self.status = status
        self.output = output or {}
        self.error = error
        self.latency_ms = latency_ms
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_name": self.agent_name,
            "status": self.status,
            "output": self.output,
            "error": self.error,
            "latency_ms": self.latency_ms,
            "timestamp": self.timestamp,
        }


class BaseAgent(ABC):
    """Base class for all DecisionOS agents."""

    name: str = "base_agent"
    description: str = "Base agent"

    async def execute(self, state: Dict[str, Any]) -> AgentResult:
        """Execute agent with timing and error handling."""
        start = time.time()
        logger.info(f"agent_start", agent=self.name)

        try:
            output = await self.run(state)
            latency = int((time.time() - start) * 1000)
            logger.info(f"agent_complete", agent=self.name, latency_ms=latency)
            return AgentResult(
                agent_name=self.name,
                status="completed",
                output=output,
                latency_ms=latency,
            )
        except Exception as e:
            latency = int((time.time() - start) * 1000)
            logger.error(f"agent_failed", agent=self.name, error=str(e))
            return AgentResult(
                agent_name=self.name,
                status="failed",
                error=str(e),
                latency_ms=latency,
            )

    @abstractmethod
    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Implement agent logic here."""
        pass
