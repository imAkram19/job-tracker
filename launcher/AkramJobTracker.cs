using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace AkramJobTracker
{
    public class Program
    {
        private static Process serverProcess = null;
        private static NotifyIcon trayIcon = null;
        private static ContextMenu trayMenu = null;
        private static string appDir = @"d:\Azhar\Projects\Akram_Job";
        private static string logPath = @"d:\Azhar\Projects\Akram_Job\logs\app-server.log";
        private static string appUrl = "http://localhost:3000";
        private static string cloudUrl = "https://github.com/imAkram19/job-tracker";

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool isNewInstance;
            using (Mutex mutex = new Mutex(true, "AkramJobTrackerSingleInstanceMutex", out isNewInstance))
            {
                if (!isNewInstance)
                {
                    // App already running, just open/focus window
                    OpenAppWindow();
                    return;
                }

                InitializeTray();
                EnsureDesktopShortcut();

                // Start local server if not already running
                if (!IsServerResponsive())
                {
                    StartBackgroundServer();
                }

                // Open the dedicated native app window
                OpenAppWindow();

                // Run message loop for System Tray
                Application.ApplicationExit += OnExit;
                AppDomain.CurrentDomain.ProcessExit += OnExit;
                Application.Run();
            }
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
                string logDir = Path.GetDirectoryName(logPath);
                if (!Directory.Exists(logDir))
                {
                    Directory.CreateDirectory(logDir);
                }

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c npm run dev";
                psi.WorkingDirectory = appDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;

                serverProcess = new Process();
                serverProcess.StartInfo = psi;

                serverProcess.OutputDataReceived += (s, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        try
                        {
                            File.AppendAllText(logPath, string.Format("[{0:HH:mm:ss}] {1}\r\n", DateTime.Now, e.Data));
                        }
                        catch { }
                    }
                };

                serverProcess.ErrorDataReceived += (s, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        try
                        {
                            File.AppendAllText(logPath, string.Format("[{0:HH:mm:ss} ERR] {1}\r\n", DateTime.Now, e.Data));
                        }
                        catch { }
                    }
                };

                serverProcess.Start();
                serverProcess.BeginOutputReadLine();
                serverProcess.BeginErrorReadLine();

                // Wait up to 12 seconds for the server to become responsive
                for (int i = 0; i < 24; i++)
                {
                    Thread.Sleep(500);
                    if (IsServerResponsive()) break;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not launch Job Tracker server:\n" + ex.Message, "Job Tracker Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void OpenAppWindow()
        {
            try
            {
                string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";

                // Chrome app mode provides a distraction-free, frameless native app look
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
            catch (Exception)
            {
                Process.Start(appUrl);
            }
        }

        private static void InitializeTray()
        {
            trayMenu = new ContextMenu();
            trayMenu.MenuItems.Add("🚀 Open Job Tracker", (s, e) => OpenAppWindow());
            trayMenu.MenuItems.Add("☁️ Open Live Repository / Vercel", (s, e) => Process.Start(cloudUrl));
            trayMenu.MenuItems.Add("📄 View Server Logs", (s, e) => {
                if (File.Exists(logPath)) Process.Start("notepad.exe", logPath);
                else MessageBox.Show("No log file found yet.", "Server Logs", MessageBoxButtons.OK, MessageBoxIcon.Information);
            });
            trayMenu.MenuItems.Add("-");
            trayMenu.MenuItems.Add("🔄 Restart Local Server", (s, e) => RestartServer());
            trayMenu.MenuItems.Add("❌ Exit Application", (s, e) => {
                Cleanup();
                Application.Exit();
            });

            trayIcon = new NotifyIcon();
            trayIcon.Text = "Akram Job Tracker Assistant (Running)";
            trayIcon.Icon = SystemIcons.Application;
            trayIcon.ContextMenu = trayMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => OpenAppWindow();
        }

        private static void RestartServer()
        {
            StopServer();
            Thread.Sleep(1000);
            StartBackgroundServer();
            OpenAppWindow();
        }

        private static void StopServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    // Kill process tree
                    ProcessStartInfo killPsi = new ProcessStartInfo("taskkill", string.Format("/F /T /PID {0}", serverProcess.Id));
                    killPsi.CreateNoWindow = true;
                    killPsi.UseShellExecute = false;
                    Process killProc = Process.Start(killPsi);
                    if (killProc != null)
                    {
                        killProc.WaitForExit(3000);
                    }
                    serverProcess = null;
                }
            }
            catch { }
        }

        private static void Cleanup()
        {
            try
            {
                if (trayIcon != null)
                {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                    trayIcon = null;
                }
                StopServer();
            }
            catch { }
        }

        private static void OnExit(object sender, EventArgs e)
        {
            Cleanup();
        }

        private static void EnsureDesktopShortcut()
        {
            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string shortcutPath = Path.Combine(desktopPath, "Akram Job Tracker.lnk");
                string exePath = Assembly.GetExecutingAssembly().Location;

                if (!File.Exists(shortcutPath) && File.Exists(exePath))
                {
                    // Create shortcut via WScript.Shell
                    Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                    if (shellType != null)
                    {
                        dynamic shell = Activator.CreateInstance(shellType);
                        dynamic shortcut = shell.CreateShortcut(shortcutPath);
                        shortcut.TargetPath = exePath;
                        shortcut.WorkingDirectory = appDir;
                        shortcut.Description = "Mohammad Akram Job Application Assistant";
                        shortcut.Save();
                    }
                }
            }
            catch { }
        }
    }
}
