rm -f ./sam-template.yaml ./packaged-template.yaml

sls sam export --output ./sam-template.yaml

aws cloudformation package \
  --template-file ./sam-template.yaml \
  --s3-bucket sammarks-cf-templates \
  --output-template-file packaged-template.yaml

PACKAGE_VERSION=$(node -p -e "require('./package.json').version")
aws s3 cp ./packaged-template.yaml "s3://sammarks-cf-templates/github-sheets-sync/$PACKAGE_VERSION/template.yaml"
aws s3 cp ./packaged-template.yaml "s3://sammarks-cf-templates/github-sheets-sync/template.yaml"
