# 面经网站项目目录结构

```text
Interview/
├── frontend/               # 前端代码目录 (如 Next.js, Vite+React/Vue 等)
│   ├── src/                
│   ├── public/             
│   └── package.json        
├── backend/                # 后端代码目录 (基于 Python，如 FastAPI, Django 等)
│   ├── app/                
│   ├── tests/              
│   └── requirements.txt    
├── scripts/                # 工具与初始化脚本目录
│   ├── init_db.py          
│   └── mock_data.py        
├── docs/                   # 项目专属文档目录
│   └── project_structure.md# 详细目录结构说明文档 (本文件)
├── logs/                   # 运行与错误日志目录
├── start.sh                # 项目启动脚本 (负责唤醒前端和服务端进程)
├── stop.sh                 # 项目停止脚本 (优雅关闭相关进程)
├── .gitignore              # Git 忽略配置
└── README.md               # 项目首页简介指引
```
