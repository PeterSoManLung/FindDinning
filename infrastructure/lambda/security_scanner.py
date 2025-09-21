import json
import boto3
import logging
from datetime import datetime
from typing import Dict, Any, List

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Automated Security Scanner Lambda Function
    Performs daily security scans and vulnerability assessments
    """
    try:
        project_name = os.environ['PROJECT_NAME']
        sns_topic_arn = os.environ['SNS_TOPIC_ARN']
        
        # Initialize AWS clients
        inspector_client = boto3.client('inspector2')
        guardduty_client = boto3.client('guardduty')
        securityhub_client = boto3.client('securityhub')
        config_client = boto3.client('config')
        sns_client = boto3.client('sns')
        
        scan_results = {}
        
        # Run Inspector V2 scans
        scan_results['inspector'] = run_inspector_scan(inspector_client)
        
        # Check GuardDuty findings
        scan_results['guardduty'] = check_guardduty_findings(guardduty_client)
        
        # Check Security Hub findings
        scan_results['securityhub'] = check_securityhub_findings(securityhub_client)
        
        # Check Config compliance
        scan_results['config'] = check_config_compliance(config_client)
        
        # Analyze results and send alerts if needed
        critical_issues = analyze_scan_results(scan_results)
        
        if critical_issues:
            send_security_alert(sns_client, sns_topic_arn, critical_issues, project_name)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Security scan completed successfully',
                'scan_timestamp': datetime.utcnow().isoformat(),
                'scan_results': scan_results,
                'critical_issues_found': len(critical_issues)
            })
        }
        
    except Exception as e:
        logger.error(f"Error in security scanning: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Security scan failed',
                'message': str(e)
            })
        }

def run_inspector_scan(inspector_client) -> Dict[str, Any]:
    """Run Inspector V2 vulnerability scans"""
    try:
        # Get scan coverage
        coverage_response = inspector_client.get_coverage_statistics()
        
        # Get findings
        findings_response = inspector_client.list_findings(
            filterCriteria={
                'severity': [
                    {'comparison': 'EQUALS', 'value': 'CRITICAL'},
                    {'comparison': 'EQUALS', 'value': 'HIGH'}
                ]
            },
            maxResults=100
        )
        
        return {
            'coverage_stats': coverage_response.get('coverageStatistics', {}),
            'critical_high_findings': len(findings_response.get('findings', [])),
            'findings': findings_response.get('findings', [])[:10]  # First 10 for summary
        }
        
    except Exception as e:
        logger.error(f"Error running Inspector scan: {str(e)}")
        return {'error': str(e)}

def check_guardduty_findings(guardduty_client) -> Dict[str, Any]:
    """Check GuardDuty threat detection findings"""
    try:
        # List detectors
        detectors_response = guardduty_client.list_detectors()
        
        if not detectors_response.get('DetectorIds'):
            return {'error': 'No GuardDuty detectors found'}
        
        detector_id = detectors_response['DetectorIds'][0]
        
        # Get findings
        findings_response = guardduty_client.list_findings(
            DetectorId=detector_id,
            FindingCriteria={
                'Criterion': {
                    'severity': {
                        'Gte': 7.0  # High and Critical severity
                    }
                }
            },
            MaxResults=50
        )
        
        finding_details = []
        if findings_response.get('FindingIds'):
            details_response = guardduty_client.get_findings(
                DetectorId=detector_id,
                FindingIds=findings_response['FindingIds'][:10]
            )
            finding_details = details_response.get('Findings', [])
        
        return {
            'detector_id': detector_id,
            'high_severity_findings': len(findings_response.get('FindingIds', [])),
            'finding_details': finding_details
        }
        
    except Exception as e:
        logger.error(f"Error checking GuardDuty findings: {str(e)}")
        return {'error': str(e)}

def check_securityhub_findings(securityhub_client) -> Dict[str, Any]:
    """Check Security Hub consolidated findings"""
    try:
        findings_response = securityhub_client.get_findings(
            Filters={
                'SeverityLabel': [
                    {'Value': 'CRITICAL', 'Comparison': 'EQUALS'},
                    {'Value': 'HIGH', 'Comparison': 'EQUALS'}
                ],
                'RecordState': [
                    {'Value': 'ACTIVE', 'Comparison': 'EQUALS'}
                ]
            },
            MaxResults=50
        )
        
        return {
            'active_critical_high_findings': len(findings_response.get('Findings', [])),
            'findings_summary': [
                {
                    'id': finding.get('Id'),
                    'title': finding.get('Title'),
                    'severity': finding.get('Severity', {}).get('Label'),
                    'product_arn': finding.get('ProductArn')
                }
                for finding in findings_response.get('Findings', [])[:10]
            ]
        }
        
    except Exception as e:
        logger.error(f"Error checking Security Hub findings: {str(e)}")
        return {'error': str(e)}

def check_config_compliance(config_client) -> Dict[str, Any]:
    """Check AWS Config compliance status"""
    try:
        # Get compliance summary
        compliance_response = config_client.get_compliance_summary_by_config_rule()
        
        # Get non-compliant rules
        rules_response = config_client.describe_config_rules()
        
        non_compliant_rules = []
        for rule in rules_response.get('ConfigRules', []):
            rule_name = rule['ConfigRuleName']
            try:
                compliance_details = config_client.get_compliance_details_by_config_rule(
                    ConfigRuleName=rule_name,
                    ComplianceTypes=['NON_COMPLIANT']
                )
                
                if compliance_details.get('EvaluationResults'):
                    non_compliant_rules.append({
                        'rule_name': rule_name,
                        'non_compliant_resources': len(compliance_details['EvaluationResults'])
                    })
            except Exception as rule_error:
                logger.warning(f"Error checking compliance for rule {rule_name}: {str(rule_error)}")
        
        return {
            'compliance_summary': compliance_response.get('ComplianceSummary', {}),
            'non_compliant_rules': non_compliant_rules
        }
        
    except Exception as e:
        logger.error(f"Error checking Config compliance: {str(e)}")
        return {'error': str(e)}

def analyze_scan_results(scan_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Analyze scan results and identify critical issues"""
    critical_issues = []
    
    # Check Inspector findings
    inspector_results = scan_results.get('inspector', {})
    if inspector_results.get('critical_high_findings', 0) > 0:
        critical_issues.append({
            'type': 'vulnerability',
            'source': 'Inspector V2',
            'severity': 'HIGH',
            'count': inspector_results['critical_high_findings'],
            'description': f"Found {inspector_results['critical_high_findings']} critical/high severity vulnerabilities"
        })
    
    # Check GuardDuty findings
    guardduty_results = scan_results.get('guardduty', {})
    if guardduty_results.get('high_severity_findings', 0) > 0:
        critical_issues.append({
            'type': 'threat_detection',
            'source': 'GuardDuty',
            'severity': 'HIGH',
            'count': guardduty_results['high_severity_findings'],
            'description': f"Found {guardduty_results['high_severity_findings']} high severity security threats"
        })
    
    # Check Security Hub findings
    securityhub_results = scan_results.get('securityhub', {})
    if securityhub_results.get('active_critical_high_findings', 0) > 0:
        critical_issues.append({
            'type': 'security_finding',
            'source': 'Security Hub',
            'severity': 'HIGH',
            'count': securityhub_results['active_critical_high_findings'],
            'description': f"Found {securityhub_results['active_critical_high_findings']} active critical/high security findings"
        })
    
    # Check Config compliance
    config_results = scan_results.get('config', {})
    non_compliant_rules = config_results.get('non_compliant_rules', [])
    if len(non_compliant_rules) > 0:
        critical_issues.append({
            'type': 'compliance_violation',
            'source': 'AWS Config',
            'severity': 'MEDIUM',
            'count': len(non_compliant_rules),
            'description': f"Found {len(non_compliant_rules)} non-compliant configuration rules"
        })
    
    return critical_issues

def send_security_alert(sns_client, topic_arn: str, critical_issues: List[Dict[str, Any]], project_name: str):
    """Send security alert notification"""
    try:
        alert_message = {
            'alert_type': 'security_scan_results',
            'project': project_name,
            'timestamp': datetime.utcnow().isoformat(),
            'critical_issues_count': len(critical_issues),
            'issues': critical_issues,
            'action_required': 'Review and remediate security findings immediately'
        }
        
        subject = f"🚨 Security Alert: {len(critical_issues)} Critical Issues Found - {project_name}"
        
        sns_client.publish(
            TopicArn=topic_arn,
            Subject=subject,
            Message=json.dumps(alert_message, indent=2)
        )
        
        logger.info(f"Security alert sent for {len(critical_issues)} critical issues")
        
    except Exception as e:
        logger.error(f"Error sending security alert: {str(e)}")
        raise