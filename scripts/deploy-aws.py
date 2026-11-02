"""Upload the static website and invalidate CloudFront. AWS credentials stay external."""
import argparse
import json
from pathlib import Path
import subprocess
import os
import uuid
from operations import call

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bucket', required=True)
    parser.add_argument('--distribution-id', required=True)
    parser.add_argument('--profile', help='Use unbought locally; omit for the CI OIDC session')
    args = parser.parse_args()
    aws = ['aws'] + (['--profile', args.profile] if args.profile else [])
    identity = json.loads(subprocess.check_output(aws + ['sts', 'get-caller-identity']))
    if identity['Account'] != '888782969020':
        raise SystemExit('Refusing deployment outside the Unbought AWS account')
    if args.bucket != 'unbought-www-888782969020-us-east-2':
        raise SystemExit('Refusing deployment to an unexpected bucket')
    distribution = json.loads(subprocess.check_output(aws + ['cloudfront', 'get-distribution', '--id', args.distribution_id]))['Distribution']
    origins = distribution['DistributionConfig']['Origins']['Items']
    if not any(o['DomainName'] == args.bucket + '.s3.us-east-2.amazonaws.com' for o in origins):
        raise SystemExit('CloudFront distribution does not serve the website bucket')
    subprocess.run(['python3', str(ROOT / 'scripts/check.py')], check=True)
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    change = 'www-' + uuid.uuid4().hex
    call(aws, 'begin-change', cid=change, scope='website', description='Website revision '+revision+'; verify edge after invalidation', actor=os.environ.get('GITHUB_ACTOR', 'operator'), iid=os.environ.get('UNBOUGHT_INCIDENT_ID'), token=os.environ.get('UNBOUGHT_INCIDENT_TOKEN'))
    # A failed/ambiguous upload intentionally leaves a running change for reconciliation.
    call(aws, 'checkpoint', cid=change)
    # Upload all files each time so metadata changes are not skipped by size/mtime checks.
    subprocess.run(aws + ['s3', 'cp', str(ROOT / 'dist'), 's3://' + args.bucket + '/',
                         '--recursive', '--exclude', '_headers', '--region', 'us-east-2',
                         '--cache-control', 'public, max-age=300, no-transform', '--only-show-errors'], check=True)
    call(aws, 'checkpoint', cid=change)
    subprocess.run(aws + ['s3', 'sync', str(ROOT / 'dist'), 's3://' + args.bucket + '/',
                         '--delete', '--exclude', '_headers', '--region', 'us-east-2', '--only-show-errors'], check=True)
    invalidation = json.loads(subprocess.check_output(aws + ['cloudfront', 'create-invalidation',
                                    '--distribution-id', args.distribution_id, '--paths', '/*']))
    subprocess.run(aws + ['cloudfront', 'wait', 'invalidation-completed', '--distribution-id',
                         args.distribution_id, '--id', invalidation['Invalidation']['Id']], check=True)
    edge = distribution['DomainName']
    subprocess.run(['python3', str(ROOT / 'scripts/check-aws.py'), '--edge', edge], check=True)
    call(aws, 'finish-change', cid=change, outcome='completed', evidence='CloudFront invalidation '+invalidation['Invalidation']['Id']+' and edge verification passed')
    print('AWS website upload and cache invalidation completed.')


if __name__ == '__main__':
    main()
