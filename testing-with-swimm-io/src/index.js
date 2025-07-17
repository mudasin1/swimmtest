const axios = require('axios');

const GITHUB_API_URL = 'https://api.github.com/user/repos';

async function createGitHubRepository(repoName, token) {
    try {
        const response = await axios.post(GITHUB_API_URL, {
            name: repoName,
            private: false,
        }, {
            headers: {
                Authorization: `token ${token}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(`Repository ${repoName} created successfully: ${response.data.html_url}`);
    } catch (error) {
        console.error(`Error creating repository: ${error.response ? error.response.data.message : error.message}`);
    }
}

// Example usage
// const token = 'your_github_token';
// createGitHubRepository('test-repo', token);