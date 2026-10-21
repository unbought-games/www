"""Upload the static website and invalidate CloudFront. AWS credentials stay external."""
import argparse
import json
from pathlib import Path
import subprocess

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
    # Upload all files each time so metadata changes are not skipped by size/mtime checks.
    subprocess.run(aws + ['s3', 'cp', str(ROOT / 'public'), 's3://' + args.bucket + '/',
                         '--recursive', '--exclude', '_headers', '--region', 'us-east-2',
                         '--cache-control', 'public, max-age=300, no-transform', '--only-show-errors'], check=True)
    subprocess.run(aws + ['s3', 'sync', str(ROOT / 'public'), 's3://' + args.bucket + '/',
                         '--delete', '--exclude', '_headers', '--region', 'us-east-2', '--only-show-errors'], check=True)
    invalidation = json.loads(subprocess.check_output(aws + ['cloudfront', 'create-invalidation',
                                    '--distribution-id', args.distribution_id, '--paths', '/*']))
    subprocess.run(aws + ['cloudfront', 'wait', 'invalidation-completed', '--distribution-id',
                         args.distribution_id, '--id', invalidation['Invalidation']['Id']], check=True)
    print('AWS website upload and cache invalidation completed.')


if __name__ == '__main__':
    main()
