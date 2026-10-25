using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace AkramJobTracker
{
    public class Program
    {
        private static Process serverProcess = null;
        private static string appDir = @"d:\Azhar\Projects\Akram_Job";
        private static string logPath = @"d:\Azhar\Projects\Akram_Job\logs\app-server.log";
        private static string appUrl = "http://localhost:3000";
        private static string cloudUrl = "https://github.com/imAkram19/job-tracker";

        [STAThread]
        public static void Main()
        {
            if (!IsServerResponsive())
            {
                StartBackgroundServer();
            }

            OpenAppWindow();

            Application.Run(new TrayContext());
        }

        private static bool IsServerResponsive()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(appUrl);
                req.Timeout = 1200;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return (int)resp.StatusCode >= 200 && (int)resp.StatusCode < 400;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void StartBackgroundServer()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                bool hasBuild = Directory.Exists(Path.Combine(appDir, ".next"));
                psi.Arguments = hasBuild ? "/c npm start" : "/c npm run dev";
                psi.WorkingDirectory = appDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                serverProcess = Process.Start(psi);

                for (int i = 0; i < 20; i++)
                {
                    Thread.Sleep(500);
                    if (IsServerResponsive()) break;
                }
            }
            catch { }
        }

        public static void OpenAppWindow()
        {
            try
            {
                string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";

                if (File.Exists(chromePath))
                {
                    Process.Start(chromePath, string.Format("--app=\"{0}\"", appUrl));
                }
                else if (File.Exists(edgePath))
                {
                    Process.Start(edgePath, string.Format("--app=\"{0}\"", appUrl));
                }
                else
                {
                    Process.Start(appUrl);
                }
            }
            catch
            {
                Process.Start(appUrl);
            }
        }

        public class TrayContext : ApplicationContext
        {
            private NotifyIcon trayIcon;

            public TrayContext()
            {
                ContextMenu menu = new ContextMenu();
                menu.MenuItems.Add("🚀 Open Job Tracker", (s, e) => OpenAppWindow());
                menu.MenuItems.Add("☁️ Open Live Repository / Vercel", (s, e) => Process.Start(cloudUrl));
                menu.MenuItems.Add("📄 View Server Logs", (s, e) => {
                    if (File.Exists(logPath)) Process.Start("notepad.exe", logPath);
                });
                menu.MenuItems.Add("-");
                menu.MenuItems.Add("❌ Exit Application", (s, e) => {
                    if (trayIcon != null) { trayIcon.Visible = false; trayIcon.Dispose(); }
                    StopServer();
                    ExitThread();
                });

                trayIcon = new NotifyIcon();
                trayIcon.Text = "Akram Job Tracker (Running)";
                trayIcon.Icon = SystemIcons.Application;
                trayIcon.ContextMenu = menu;
                trayIcon.Visible = true;
                trayIcon.DoubleClick += (s, e) => OpenAppWindow();
            }
        }

        private static void StopServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    Process p = Process.Start(new ProcessStartInfo("taskkill", string.Format("/F /T /PID {0}", serverProcess.Id)) {
                        CreateNoWindow = true,
                        UseShellExecute = false
                    });
                    if (p != null) p.WaitForExit(3000);
                }
            }
            catch { }
        }
    }
}
