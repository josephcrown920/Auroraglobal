export type FreeGpuPlatform = "colab" | "kaggle";
export type FreeGpuOption = { id:FreeGpuPlatform; name:string; gpu:string; protocol:"comfyui"|"custom"; capabilities:string[]; launcherPath:string; notebookPath:string; notes:string[] };
export const FREE_GPU_OPTIONS:FreeGpuOption[]=[
{id:"colab",name:"Google Colab Free GPU",gpu:"T4/P100 (availability varies)",protocol:"comfyui",capabilities:["image","video","lipsync","motion"],launcherPath:"/downloads/gpu/aurora_worker_colab.py",notebookPath:"/downloads/gpu/aurora_worker_colab.ipynb",notes:["Requires a GPU runtime and Internet enabled.","Worker can register with Aurora when registration credentials are configured.","Free-tier availability and session duration are controlled by Colab."]},
{id:"kaggle",name:"Kaggle Free GPU",gpu:"T4/P100 (availability varies)",protocol:"comfyui",capabilities:["image","video","lipsync","motion"],launcherPath:"/downloads/gpu/aurora_worker_kaggle.py",notebookPath:"/downloads/gpu/aurora_worker_kaggle.ipynb",notes:["Requires GPU accelerator and Internet enabled.","Worker can register with Aurora when registration credentials are configured.","Kaggle controls session limits and GPU availability."]}
];
