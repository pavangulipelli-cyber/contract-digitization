#!/usr/bin/env python3
"""Reset PostgreSQL sequences after seeding data."""

from db_pg import get_conn

def reset_sequences():
    """Reset all sequences to prevent duplicate key errors."""
    conn = get_conn()
    cursor = conn.cursor()
    
    try:
        # Reset attribute_reviews sequence
        cursor.execute("""
            SELECT setval('attribute_reviews_id_seq', 
                         COALESCE((SELECT MAX(id) FROM attribute_reviews), 0) + 1, 
                         false)
        """)
        print("✅ Reset attribute_reviews_id_seq")
        
        conn.commit()
        print("✅ All sequences reset successfully")
        
    except Exception as e:
        print(f"❌ Error resetting sequences: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    reset_sequences()
