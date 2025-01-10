import * as OBC from "@thatopen/components";
// Your lint can have trouble accessing octokit, use this line below
// eslint-disable-next-line import/no-unresolved
import { Octokit } from "octokit";
import * as BUI from "@thatopen/ui";

// This is an interface for handling the data we need from the files
export interface fileData {
  name: string;
  commits: BUI.Dropdown;
}

export class GitHub extends OBC.Component {
  enabled = false;
  static readonly uuid = "358585a9-f007-4aa2-baf7-9cc863631780";
  octokit: Octokit;

  // These are the main parameters we need to connect to the repo.
  owner: string | null = null;
  repo: string | null = null;

  // These Arrays will help us store the files info from the repo
  // And then filter the commits that match an specific file
  filesList: fileData[] = [];

  // An event to update the UI, see below.
  onConnect: OBC.Event<void>;

  constructor(components: OBC.Components) {
    super(components);
    components.add(GitHub.uuid, this);

    this.octokit = new Octokit({
      auth: import.meta.env.GITHUB_TOKEN,
    });

    this.onConnect = new OBC.Event();
  }

  // A connect function that will be called from the UI
  async connect(owner: string, repo: string) {
    if (!owner || !repo) {
      throw new Error("No repo or owner set.");
    }

    this.owner = owner;
    this.repo = repo;

    // A request to the contents, this allow us to get the files info
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/contents/",
      {
        owner: this.owner,
        repo: this.repo,
      },
    );

    // Filter a specific file
    this.filesList = response.data.filter((file: fileData) =>
      file.name.endsWith(".ifc"),
    );

    // Call the commits to build the matchingCommits array so that the
    // UI can display it
    await this.getCommits();

    // Use the event to trigger added commands
    // The command is added in the UI, check the next section below
    this.onConnect.trigger();
  }

  async getCommits() {
    if (!this.owner || !this.repo) {
      return;
    }
  
    for (const [index, file] of this.filesList.entries()) {
      if (!file) {
        continue;
      }
  
      const commitsDrop = document.createElement("bim-dropdown");
      commitsDrop.vertical = true;
      commitsDrop.required = true;
  
      // Add event listener to handle dropdown value changes
      commitsDrop.addEventListener("change", async (event) => {
        // Remove all menus using BUI.ContextMenu.removeMenus()
        BUI.ContextMenu.removeMenus();
  
        const selectedCommitSha = (event.target as HTMLSelectElement).value;
  
        // Retrieve the file with the selected commit SHA
        if (selectedCommitSha) {
          await this.getFile(file, selectedCommitSha);
        }
      });
  
      // Commits endpoint. The data is separated, the files do
      // not contain the commits, but the commits do contain the files.
      const commits = await this.octokit.request(
        "GET /repos/{owner}/{repo}/commits/",
        {
          owner: this.owner,
          repo: this.repo,
        },
      );
  
      // Iterate each commit and get more detailed data, like the files
      for (const commit of commits.data) {
        const commitData = await this.octokit.request(
          "GET /repos/{owner}/{repo}/commits/{ref}",
          {
            owner: this.owner,
            repo: this.repo,
            ref: commit.sha,
          },
        );
  
        // Get an array with the files.
        const commitFiles = commitData.data.files?.map((file) => file.filename);
        if (!commitFiles) continue;
  
        // If the file in turn is included in the commit, create an option
        if (commitFiles.includes(file.name)) {
          const option = document.createElement("bim-option");
  
          // Set the label to the commit message
          option.setAttribute("label", commitData.data.commit.message);
  
          // Set the value to a JSON string containing the file and commit SHA
          option.setAttribute(
            "value",
            JSON.stringify({ file, sha: commit.sha }),
          );
  
          // Append the option to the dropdown
          commitsDrop.appendChild(option);
        }
      }
  
      // Outside of the commits for loop, assign commitsDrop to file.commits
      file.commits = commitsDrop;
  
      // Reassign the updated file object back to the filesList array
      this.filesList[index] = file;
    }
  }

  // A function to remove a model when we select a different version
  // This helps us avoid overlapping or duplicate models in the viewer.
  removeCurrentModel() {
    const fragments = this.components.get(OBC.FragmentsManager);

    for (const [_, model] of fragments.groups.entries()) {
      fragments.disposeGroup(model);
    }
  }

  async getFile(file: fileData, commitSha: string) {
    if (!this.owner || !this.repo) {
      return;
    }
    console.log(file);

    this.removeCurrentModel();

    const loader = this.components.get(OBC.IfcLoader);

    // Do the request to the contents, this time providing the path and the ref.
    // The ref can either be a branch or a commit, without it, the most recent version
    // is returned.
    const commitResponse = await this.octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: this.owner,
        repo: this.repo,
        path: file.name,
        ref: commitSha,
      },
    );

    // The response can be multiple things, the one we should get contains a download URL
    if (!("download_url" in commitResponse.data)) return;
    const downloadUrl = commitResponse.data.download_url as string;

    const response = await fetch(downloadUrl);
    const data = await response.arrayBuffer();
    const buffer = new Uint8Array(data);
    await loader.load(buffer);
  }
}

export * from "./src";
