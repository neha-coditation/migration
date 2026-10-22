import fs from 'node:fs/promises';
import path from 'node:path';
export async function addDeployment(project){
 await fs.mkdir(path.join(project,'.github/workflows'),{recursive:true});await fs.mkdir(path.join(project,'scripts'),{recursive:true});
 await fs.copyFile(new URL('./templates/github-pages.mjs',import.meta.url),path.join(project,'scripts/github-pages.mjs'));
 await fs.writeFile(path.join(project,'.github/workflows/deploy.yml'),`name: Deploy Astro to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Configure GitHub Pages URL
        shell: bash
        env:
          REPOSITORY: \${{ github.repository }}
          OWNER: \${{ github.repository_owner }}
        run: |
          repo="\${REPOSITORY#*/}"
          echo "ASTRO_SITE=https://\${OWNER}.github.io" >> "$GITHUB_ENV"
          if [ "\${repo,,}" = "\${OWNER,,}.github.io" ]; then
            echo "ASTRO_BASE=/" >> "$GITHUB_ENV"
          else
            echo "ASTRO_BASE=/$repo" >> "$GITHUB_ENV"
          fi
      - uses: withastro/action@v6
        with:
          node-version: 24
          package-manager: npm
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v5
        id: deployment
`);
 await fs.writeFile(path.join(project,'DEPLOY-GITHUB-PAGES.md'),`# Deploy this Astro project to GitHub Pages\n\nNothing has been published. Upload the CONTENTS of this astro-project folder to your GitHub repository root, including .github, package-lock.json and scripts. Use the main branch, or change the workflow trigger. In Settings → Pages choose GitHub Actions. Pushing the workflow then builds and deploys the site.\n\nThe workflow sets ASTRO_SITE and ASTRO_BASE automatically for ordinary username.github.io/repository sites and username.github.io repositories. For a private organization Pages URL, edit ASTRO_SITE to the URL GitHub provides. For a custom domain, set ASTRO_SITE to your domain, ASTRO_BASE=/, and add public/CNAME. No domain or DNS changes are made by this ZIP.\n\nLocal preview: npm ci, npm run build, npm run preview. To test a repository path: ASTRO_SITE=https://your-name.github.io ASTRO_BASE=/your-repo npm run build. npm run preview then serves the project at /your-repo/. Rebuild after changing base; the postbuild script prefixes captured links, assets, CSS and JavaScript URLs in dist. Never upload the old root-base dist when targeting a repository path. When ASTRO_SITE is supplied, the deployment build updates canonical links, og:url, sitemap and robots sitemap URLs to that site and base. Without ASTRO_SITE the original source SEO URLs are retained.\n\nOfficial guide: https://docs.astro.build/en/guides/deploy/github/\n\nA deployment-ready build is not a visual-fidelity approval. Read migration-report.json for animation, illustration and interaction findings. Forms/backends and uncaptured routes remain as documented.\n`);
 await fs.writeFile(path.join(project,'.gitignore'),'node_modules/\ndist/\n.astro/\n.env\n');
}
