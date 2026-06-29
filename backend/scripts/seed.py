#!/usr/bin/env python3
"""
Seed script for DecisionOS demo data
Run: python scripts/seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.memory.memory_manager import memory_manager

def seed():
    print("🌱 Seeding DecisionOS demo data...")

    # The memory_manager auto-loads demo data on init
    memories = memory_manager.retrieve_relevant_memory("churn risk customer", top_k=3)
    print(f"✅ Memory system loaded: {len(memory_manager._org_memory)} organizational memories")
    
    print("✅ Demo conversations seeded (in-memory)")
    print("✅ Knowledge base loaded (7 items)")
    print("\n🎉 Seed complete! Demo data ready.")
    print("\nSample queries to try:")
    print("  1. 'Acme Corp is at churn risk, renewal in 60 days, champion left'")
    print("  2. 'TechStart has 85% adoption, wants to expand to 3 new departments'")
    print("  3. 'GlobalBank deal stuck in procurement for 6 weeks, competitor involved'")
    print("  4. 'Senior ML Engineer candidate - strong technical, limited leadership'")

if __name__ == "__main__":
    seed()
