#!/bin/bash
# Setup script to create symbolic links for shared data between Express and FastAPI backends

echo "Setting up shared data folder for FastAPI backend..."

cd "$(dirname "$0")/fastapi_server"

# Create symbolic link to data folder
if [ -e data ]; then
    echo "Data folder already exists, skipping..."
else
    ln -s ../express_server/data data
    if [ $? -eq 0 ]; then
        echo "✅ Created symbolic link: fastapi_server/data -> express_server/data"
    else
        echo "❌ Failed to create symbolic link"
        exit 1
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the FastAPI server:"
echo "  cd fastapi_server"
echo "  pip install -r requirements.txt"
echo "  uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
