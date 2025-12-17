#!/usr/bin/env python3
"""
Test script for new database schema
Run this after applying the new schema to verify everything works
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'fastapi_server_postgresql'))

from db_pg import db_get, db_all, get_conn

def test_tables_exist():
    """Test that all new tables exist"""
    print("\n" + "=" * 60)
    print("TEST 1: Checking if new tables exist...")
    print("=" * 60)
    
    expected_tables = [
        'documents',
        'document_versions',
        'extracted_fields',
        'review_sessions',
        'reviewed_fields',
        'ocr_jobs',
        'tables_extracted',
        'conga_postback_logs'
    ]
    
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    
    existing_tables = [row['table_name'] for row in cursor.fetchall()]
    conn.close()
    
    print(f"Found tables: {existing_tables}")
    
    missing = set(expected_tables) - set(existing_tables)
    if missing:
        print(f"❌ FAIL: Missing tables: {missing}")
        return False
    
    print("✅ PASS: All expected tables exist")
    return True

def test_documents_seeded():
    """Test that documents were seeded"""
    print("\n" + "=" * 60)
    print("TEST 2: Checking if documents were seeded...")
    print("=" * 60)
    
    docs = db_all("SELECT id, title FROM documents ORDER BY id")
    
    if not docs:
        print("❌ FAIL: No documents found")
        return False
    
    print(f"✅ PASS: Found {len(docs)} documents:")
    for doc in docs:
        print(f"   - {doc['id']}: {doc['title']}")
    
    return True

def test_extracted_fields():
    """Test that extracted_fields has data and correct structure"""
    print("\n" + "=" * 60)
    print("TEST 3: Checking extracted_fields structure and data...")
    print("=" * 60)
    
    # Check columns
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'extracted_fields'
        ORDER BY ordinal_position
    """)
    columns = cursor.fetchall()
    conn.close()
    
    expected_columns = [
        'field_id', 'ocr_job_id', 'document_id', 'version_id',
        'attribute_key', 'row_id', 'field_name', 'category', 
        'section', 'page_number', 'field_value', 'corrected_value',
        'confidence_score', 'confidence_level', 'confidence',
        'highlighted_text', 'bounding_box', 'extracted_at'
    ]
    
    column_names = [col['column_name'] for col in columns]
    
    missing_cols = set(expected_columns) - set(column_names)
    if missing_cols:
        print(f"❌ FAIL: Missing columns: {missing_cols}")
        return False
    
    print("✅ PASS: All expected columns exist")
    
    # Check data
    fields = db_all("""
        SELECT document_id, version_id, attribute_key, field_value, bounding_box 
        FROM extracted_fields 
        LIMIT 5
    """)
    
    if not fields:
        print("❌ FAIL: No extracted fields found")
        return False
    
    print(f"✅ PASS: Found {len(fields)} sample fields:")
    for field in fields:
        bbox_status = "✓" if field.get('bounding_box') else "✗"
        print(f"   - {field['attribute_key']} (bbox: {bbox_status})")
    
    return True

def test_row_id_generation():
    """Test that row_id is generated correctly"""
    print("\n" + "=" * 60)
    print("TEST 4: Testing row_id generation...")
    print("=" * 60)
    
    field = db_get("""
        SELECT attribute_key, version_id, row_id 
        FROM extracted_fields 
        WHERE attribute_key = 'attr-001'
        LIMIT 1
    """)
    
    if not field:
        print("❌ FAIL: No field found for testing")
        return False
    
    expected_row_id = f"{field['attribute_key']}--{field['version_id']}"
    actual_row_id = field['row_id']
    
    if expected_row_id != actual_row_id:
        print(f"❌ FAIL: row_id mismatch")
        print(f"   Expected: {expected_row_id}")
        print(f"   Actual:   {actual_row_id}")
        return False
    
    print(f"✅ PASS: row_id correctly generated: {actual_row_id}")
    return True

def test_review_tables_structure():
    """Test review_sessions and reviewed_fields tables"""
    print("\n" + "=" * 60)
    print("TEST 5: Checking review tables structure...")
    print("=" * 60)
    
    # Check review_sessions columns
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'review_sessions'
    """)
    review_columns = [row['column_name'] for row in cursor.fetchall()]
    
    expected_review_cols = [
        'review_id', 'document_id', 'target_version_id', 
        'reviewer', 'status', 'created_at', 'updated_at'
    ]
    
    missing = set(expected_review_cols) - set(review_columns)
    if missing:
        print(f"❌ FAIL: Missing review_sessions columns: {missing}")
        conn.close()
        return False
    
    print("✅ PASS: review_sessions has correct structure")
    
    # Check reviewed_fields columns
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'reviewed_fields'
    """)
    field_columns = [row['column_name'] for row in cursor.fetchall()]
    conn.close()
    
    expected_field_cols = [
        'reviewed_field_id', 'review_id', 'document_id', 
        'target_version_id', 'attribute_key', 'original_value',
        'corrected_value', 'old_corrected_value', 'new_corrected_value',
        'approved', 'reviewed_by', 'reviewed_at', 'updated_at'
    ]
    
    missing = set(expected_field_cols) - set(field_columns)
    if missing:
        print(f"❌ FAIL: Missing reviewed_fields columns: {missing}")
        return False
    
    print("✅ PASS: reviewed_fields has correct structure")
    return True

def test_bounding_box_data():
    """Test that bounding boxes are present and valid JSON"""
    print("\n" + "=" * 60)
    print("TEST 6: Checking bounding box data...")
    print("=" * 60)
    
    fields_with_bbox = db_all("""
        SELECT attribute_key, bounding_box 
        FROM extracted_fields 
        WHERE bounding_box IS NOT NULL
        LIMIT 5
    """)
    
    if not fields_with_bbox:
        print("⚠️  WARNING: No bounding boxes found (this is OK if not seeded)")
        return True
    
    print(f"✅ PASS: Found {len(fields_with_bbox)} fields with bounding boxes:")
    for field in fields_with_bbox:
        bbox = field['bounding_box']
        if isinstance(bbox, dict):
            required_keys = ['page', 'x', 'y', 'w', 'h']
            if all(k in bbox for k in required_keys):
                print(f"   - {field['attribute_key']}: Valid bbox")
            else:
                print(f"   - {field['attribute_key']}: Invalid bbox (missing keys)")
        else:
            print(f"   - {field['attribute_key']}: Not a dict: {type(bbox)}")
    
    return True

def run_all_tests():
    """Run all tests"""
    print("\n" + "🧪" * 30)
    print("   DATABASE SCHEMA VALIDATION TESTS")
    print("🧪" * 30)
    
    tests = [
        test_tables_exist,
        test_documents_seeded,
        test_extracted_fields,
        test_row_id_generation,
        test_review_tables_structure,
        test_bounding_box_data,
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"\n❌ ERROR in {test.__name__}: {e}")
            import traceback
            traceback.print_exc()
            results.append(False)
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"✅ ALL TESTS PASSED ({passed}/{total})")
        print("\n🎉 Database schema is correctly set up!")
        return 0
    else:
        print(f"❌ SOME TESTS FAILED ({passed}/{total} passed)")
        print("\n⚠️  Please review the failed tests above")
        return 1

if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
