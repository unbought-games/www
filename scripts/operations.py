"""Small operations client; incident policy and state live in unbought-games/infra."""
import json
from pathlib import Path
import subprocess
import tempfile

def call(aws,action,**params):
    with tempfile.TemporaryDirectory() as directory:
        request=Path(directory)/'request.json';reply=Path(directory)/'reply.json'
        request.write_text(json.dumps({'action':action,'params':params}));request.chmod(0o600)
        result=subprocess.run(aws+['lambda','invoke','--region','us-east-2','--function-name','unbought-operations','--payload','fileb://'+str(request),str(reply)],capture_output=True)
        if result.returncode:raise RuntimeError('Operational coordination unavailable; website deployment held')
        body=json.loads(reply.read_text())
        if not body.get('ok'):raise RuntimeError(body.get('error','Operational change rejected'))
        return body['result']
