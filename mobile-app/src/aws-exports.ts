const awsconfig = {
  aws_project_region: process.env.AWS_REGION || 'ap-southeast-1',
  aws_cognito_identity_pool_id: process.env.AWS_COGNITO_IDENTITY_POOL_ID || '',
  aws_cognito_region: process.env.AWS_REGION || 'ap-southeast-1',
  aws_mobile_analytics_app_id: process.env.PINPOINT_APP_ID || '',
  aws_mobile_analytics_app_region: process.env.AWS_REGION || 'ap-southeast-1',
  
  // API Gateway configuration
  aws_cloud_logic_custom: [
    {
      name: 'FindDiningAPI',
      endpoint: process.env.API_GATEWAY_URL || 'https://api.finddining.com',
      region: process.env.AWS_REGION || 'ap-southeast-1'
    }
  ],
  
  // AppSync configuration for OTA updates
  aws_appsync_graphqlEndpoint: process.env.APPSYNC_GRAPHQL_ENDPOINT || '',
  aws_appsync_region: process.env.AWS_REGION || 'ap-southeast-1',
  aws_appsync_authenticationType: 'API_KEY',
  aws_appsync_apiKey: process.env.APPSYNC_API_KEY || '',
  
  // Storage configuration
  aws_user_files_s3_bucket: process.env.S3_BUCKET || '',
  aws_user_files_s3_bucket_region: process.env.AWS_REGION || 'ap-southeast-1',
  
  // Analytics configuration
  Analytics: {
    AWSPinpoint: {
      appId: process.env.PINPOINT_APP_ID || '',
      region: process.env.AWS_REGION || 'ap-southeast-1',
      mandatorySignIn: false,
      endpoint: {
        region: process.env.AWS_REGION || 'ap-southeast-1',
        service: 'mobiletargeting'
      }
    }
  }
};

export default awsconfig;