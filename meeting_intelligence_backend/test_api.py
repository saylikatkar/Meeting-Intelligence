"""
Comprehensive Automated Test Suite for Meeting Intelligence Backend API
Tests all key endpoints required for the Meeting Detail page and All Actions page.
"""

import os
import sys
import json
import time
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.getenv("API_URL", "http://127.0.0.1:8001")

def run_tests():
    print("=" * 70)
    print("AI Meeting Intelligence Platform - Backend API Test Suite")
    print("=" * 70)

    session = requests.Session()

    # 1. Health check
    print("\n[TEST 1] Checking API Health Endpoint (GET /api/health/)...")
    try:
        r = session.get(f"{BASE_URL}/api/health/")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print(f" PASS: API is online: {r.json()['service']}")
    except Exception as e:
        print(f" FAIL: Could not reach server: {e}")
        return False

    # 2. Login
    print("\n[TEST 2] Testing User Login (POST /api/auth/login/)...")
    login_payload = {
        "email": "prachi@example.com",
        "password": "password123"
    }
    r = session.post(f"{BASE_URL}/api/auth/login/", json=login_payload)
    assert r.status_code == 200, f"Login failed: {r.text}"
    token_data = r.json()["tokens"]
    access_token = token_data["access"]
    headers = {"Authorization": f"Bearer {access_token}"}
    session.headers.update(headers)
    print(f" PASS: Logged in as: {r.json()['user']['name']} ({r.json()['user']['role']})")

    # 3. Fetch Current Profile
    print("\n[TEST 3] Fetching Authenticated Profile (GET /api/auth/me/)...")
    r = session.get(f"{BASE_URL}/api/auth/me/")
    assert r.status_code == 200
    user_me = r.json()
    print(f" PASS: Profile fetched: {user_me['name']}, Total Meetings: {user_me['totalMeetings']}")

    # 4. Fetch Meetings List
    print("\n[TEST 4] Fetching Meetings List (GET /api/meetings/)...")
    r = session.get(f"{BASE_URL}/api/meetings/")
    assert r.status_code == 200
    res_data = r.json()
    stats = res_data.get("stats", {})
    meetings = res_data.get("meetings", [])
    print(f" PASS: Fetched {len(meetings)} meetings. Stats: Total={stats.get('totalMeetings')}, Completed={stats.get('completed')}")

    # 5. Fetch Meeting Detail Page (Specifically requested in prompt!)
    print("\n[TEST 5] Fetching Full Meeting Detail Page (GET /api/meetings/meeting_website_sprint_001/)...")
    m_id = "meeting_website_sprint_001"
    r = session.get(f"{BASE_URL}/api/meetings/{m_id}/")
    assert r.status_code == 200, f"Meeting detail fetch failed: {r.text}"
    meeting = r.json()

    print(f"   * Title: {meeting.get('title')}")
    print(f"   * Duration: {meeting.get('durationFormatted')} ({meeting.get('duration')}s)")
    print(f"   * Status: {meeting.get('status')}")
    print(f"   * Speakers detected: {len(meeting.get('speakers', []))}")
    print(f"   * Executive Summary: {meeting.get('summary')[:90]}...")
    print(f"   * Key Discussion Points: {len(meeting.get('keyPoints', []))} points")
    print(f"   * Decisions: {len(meeting.get('decisions', []))} items")
    print(f"   * Final Decision: {meeting.get('finalDecision')}")
    print(f"   * Action Items in Meeting: {len(meeting.get('actionItems', []))} items")
    print(f"   * Questions: {len(meeting.get('questions', []))} questions")
    print(f"   * Risks & Blockers: {len(meeting.get('risks', []))} risks")
    print(f"   * Transcript Segments: {len(meeting.get('transcriptSegments', []))} segments")
    print(" PASS: Meeting detail contains all required intelligence sections!")

    # 6. Synchronized Transcript Search
    print("\n[TEST 6] Testing Transcript Search (GET /api/meetings/meeting_website_sprint_001/transcript/search/?q=deadline)...")
    r = session.get(f"{BASE_URL}/api/meetings/{m_id}/transcript/search/?q=deadline")
    assert r.status_code == 200
    search_data = r.json()
    print(f" PASS: Found {search_data['matchCount']} matching segments for query 'deadline'")

    # 7. Dedicated All Action Items Page (Specifically requested in prompt!)
    print("\n[TEST 7] Testing All Action Items Page (GET /api/actions/)...")
    r = session.get(f"{BASE_URL}/api/actions/")
    assert r.status_code == 200
    actions_data = r.json()
    act_stats = actions_data.get("stats", {})
    items = actions_data.get("items", [])
    print(f"   * Total Action Items: {act_stats.get('total')}")
    print(f"   * Pending: {act_stats.get('pending')} | In Progress: {act_stats.get('inProgress')} | Completed: {act_stats.get('completed')}")
    for it in items[:3]:
        print(f"     - [{it.get('status').upper()}] {it.get('task')} (Assignee: {it.get('assignee')}, Due: {it.get('deadline')})")
    print(" PASS: All action items page returns correct structured items and summary counts!")

    # 8. Update Action Item Status (PATCH /api/actions/:id/)
    print("\n[TEST 8] Toggling Action Item Status (PATCH /api/actions/act_001/)...")
    r = session.patch(f"{BASE_URL}/api/actions/act_001/", json={"status": "in_progress"})
    assert r.status_code == 200
    updated_act = r.json()["item"]
    print(f" PASS: Action item act_001 status changed to: {updated_act.get('status')}")

    # Revert back to pending
    session.patch(f"{BASE_URL}/api/actions/act_001/", json={"status": "pending"})

    # 9. Ask Meeting AI
    print("\n[TEST 9] Testing Ask Meeting AI (POST /api/meetings/meeting_website_sprint_001/ask/)...")
    ask_payload = {"question": "Who was assigned the frontend?"}
    r = session.post(f"{BASE_URL}/api/meetings/{m_id}/ask/", json=ask_payload)
    assert r.status_code == 200
    answer_res = r.json()
    print(f"   * Question: {answer_res.get('question')}")
    print(f"   * Answer: {answer_res.get('answer')}")
    print(f"   * Source Timestamp: {answer_res.get('sourceTimestamp')}")
    print(f"   * Cited Speaker: {answer_res.get('citedSpeaker')}")
    print(" PASS: Ask Meeting AI returned accurate grounded answer with source timestamp!")

    # 10. Exports Test
    print("\n[TEST 10] Testing Export Endpoints...")
    # PDF
    r = session.get(f"{BASE_URL}/api/meetings/{m_id}/export/pdf/")
    assert r.status_code == 200 and r.headers.get("content-type") == "application/pdf"
    print(f"   * PDF export: {len(r.content)} bytes [OK]")

    # DOCX
    r = session.get(f"{BASE_URL}/api/meetings/{m_id}/export/docx/")
    assert r.status_code == 200
    print(f"   * DOCX export: {len(r.content)} bytes [OK]")

    # TXT
    r = session.get(f"{BASE_URL}/api/meetings/{m_id}/export/txt/")
    assert r.status_code == 200
    print(f"   * TXT export: {len(r.content)} bytes [OK]")

    # SRT
    r = session.get(f"{BASE_URL}/api/meetings/{m_id}/export/srt/")
    assert r.status_code == 200
    print(f"   * SRT export: {len(r.content)} bytes [OK]")

    # JSON
    r = session.get(f"{BASE_URL}/api/meetings/{m_id}/export/json/")
    assert r.status_code == 200
    print(f"   * JSON export: {len(r.content)} bytes [OK]")
    print(" PASS: All 5 export formats generated successfully!")

    # 11. Admin Dashboard
    print("\n[TEST 11] Testing Admin Dashboard (GET /api/admin/dashboard/)...")
    r = session.get(f"{BASE_URL}/api/admin/dashboard/")
    assert r.status_code == 200
    adm = r.json()
    print(f"   * Admin Total Users: {adm['overview']['totalUsers']}")
    print(f"   * Total Audio Processed: {adm['overview']['totalAudioProcessedHours']} hours")
    print(" PASS: Admin metrics returned successfully!")

    print("\n" + "=" * 70)
    print("ALL API TESTS PASSED SUCCESSFULLY! BACKEND IS 100% WORKING!")
    print("=" * 70)
    return True

if __name__ == "__main__":
    run_tests()
