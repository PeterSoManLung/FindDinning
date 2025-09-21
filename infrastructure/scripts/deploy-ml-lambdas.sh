#!/bin/bash

# Deploy ML Lambda Functions
# This script packages and deploys all ML-related Lambda functions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$SCRIPT_DIR/../lambda"
TEMP_DIR="/tmp/lambda-packages"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ML Lambda deployment...${NC}"

# Create temporary directory for packages
mkdir -p "$TEMP_DIR"

# Function to package and create Lambda function
package_lambda() {
    local function_name=$1
    local function_dir="$LAMBDA_DIR/$function_name"
    local package_file="$TEMP_DIR/${function_name}.zip"
    
    echo -e "${YELLOW}Packaging $function_name...${NC}"
    
    if [ ! -d "$function_dir" ]; then
        echo -e "${RED}Error: Function directory $function_dir does not exist${NC}"
        return 1
    fi
    
    # Create package
    cd "$function_dir"
    
    # Install dependencies if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        echo "Installing Python dependencies..."
        pip install -r requirements.txt -t .
    fi
    
    # Create zip package
    zip -r "$package_file" . -x "*.pyc" "__pycache__/*" "*.git*"
    
    echo -e "${GREEN}Packaged $function_name successfully${NC}"
    echo "$package_file"
}

# Function to create requirements.txt for each Lambda
create_requirements() {
    local function_name=$1
    local function_dir="$LAMBDA_DIR/$function_name"
    
    case $function_name in
        "bedrock_nlp_processor")
            cat > "$function_dir/requirements.txt" << EOF
boto3>=1.26.0
botocore>=1.29.0
EOF
            ;;
        "model_version_manager")
            cat > "$function_dir/requirements.txt" << EOF
boto3>=1.26.0
botocore>=1.29.0
EOF
            ;;
        "ab_test_manager")
            cat > "$function_dir/requirements.txt" << EOF
boto3>=1.26.0
botocore>=1.29.0
EOF
            ;;
        "model_performance_monitor")
            cat > "$function_dir/requirements.txt" << EOF
boto3>=1.26.0
botocore>=1.29.0
EOF
            ;;
        "model_retraining_trigger")
            cat > "$function_dir/requirements.txt" << EOF
boto3>=1.26.0
botocore>=1.29.0
EOF
            ;;
    esac
}

# List of Lambda functions to deploy
LAMBDA_FUNCTIONS=(
    "bedrock_nlp_processor"
    "model_version_manager"
    "ab_test_manager"
    "model_performance_monitor"
    "model_retraining_trigger"
)

# Create requirements.txt files
echo -e "${YELLOW}Creating requirements.txt files...${NC}"
for func in "${LAMBDA_FUNCTIONS[@]}"; do
    create_requirements "$func"
done

# Package all Lambda functions
echo -e "${YELLOW}Packaging Lambda functions...${NC}"
for func in "${LAMBDA_FUNCTIONS[@]}"; do
    package_file=$(package_lambda "$func")
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $func packaged successfully${NC}"
        
        # Copy to terraform directory for deployment
        cp "$package_file" "$SCRIPT_DIR/../terraform/"
        echo -e "${GREEN}✓ $func package copied to terraform directory${NC}"
    else
        echo -e "${RED}✗ Failed to package $func${NC}"
        exit 1
    fi
done

# Create sample model artifacts for testing
echo -e "${YELLOW}Creating sample model artifacts...${NC}"
create_sample_models() {
    local models_dir="$TEMP_DIR/sample-models"
    mkdir -p "$models_dir/recommendation/1.0.0"
    mkdir -p "$models_dir/sentiment/1.0.0"
    
    # Create dummy model files
    echo "# Recommendation Model v1.0.0" > "$models_dir/recommendation/1.0.0/model.py"
    echo "# Sentiment Model v1.0.0" > "$models_dir/sentiment/1.0.0/model.py"
    
    # Create tar.gz files
    cd "$models_dir/recommendation/1.0.0"
    tar -czf "../../../recommendation-model-1.0.0.tar.gz" .
    
    cd "$models_dir/sentiment/1.0.0"
    tar -czf "../../../sentiment-model-1.0.0.tar.gz" .
    
    echo -e "${GREEN}✓ Sample model artifacts created${NC}"
}

create_sample_models

# Create deployment validation script
cat > "$SCRIPT_DIR/validate-ml-deployment.sh" << 'EOF'
#!/bin/bash

# Validate ML Lambda deployment

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Validating ML Lambda deployment...${NC}"

# Check if Lambda functions exist
LAMBDA_FUNCTIONS=(
    "ai-restaurant-recommendation-bedrock-nlp-processor"
    "ai-restaurant-recommendation-model-version-manager"
    "ai-restaurant-recommendation-ab-test-manager"
    "ai-restaurant-recommendation-model-performance-monitor"
    "ai-restaurant-recommendation-model-retraining-trigger"
)

for func in "${LAMBDA_FUNCTIONS[@]}"; do
    if aws lambda get-function --function-name "$func" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ $func exists${NC}"
    else
        echo -e "${RED}✗ $func not found${NC}"
    fi
done

# Test Bedrock NLP processor
echo -e "${YELLOW}Testing Bedrock NLP processor...${NC}"
test_payload='{"text": "I love this restaurant!", "analysis_type": "sentiment"}'
if aws lambda invoke --function-name "ai-restaurant-recommendation-bedrock-nlp-processor" \
    --payload "$test_payload" \
    /tmp/bedrock-test-response.json >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Bedrock NLP processor test successful${NC}"
else
    echo -e "${RED}✗ Bedrock NLP processor test failed${NC}"
fi

# Test model version manager
echo -e "${YELLOW}Testing model version manager...${NC}"
test_payload='{"action": "list_versions", "model_name": "recommendation"}'
if aws lambda invoke --function-name "ai-restaurant-recommendation-model-version-manager" \
    --payload "$test_payload" \
    /tmp/version-manager-test-response.json >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Model version manager test successful${NC}"
else
    echo -e "${RED}✗ Model version manager test failed${NC}"
fi

echo -e "${GREEN}ML Lambda validation complete${NC}"
EOF

chmod +x "$SCRIPT_DIR/validate-ml-deployment.sh"

# Clean up temporary directory
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
rm -rf "$TEMP_DIR"

echo -e "${GREEN}ML Lambda deployment preparation complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run 'terraform plan' to review the infrastructure changes"
echo "2. Run 'terraform apply' to deploy the ML infrastructure"
echo "3. Run './validate-ml-deployment.sh' to validate the deployment"
echo ""
echo -e "${GREEN}All Lambda packages are ready in the terraform directory${NC}"