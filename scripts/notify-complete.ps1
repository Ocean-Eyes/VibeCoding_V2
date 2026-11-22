param([string]$DevicePattern = 'Realtek', [switch]$List)
# Cached Korean male speech, generated once with ko-KR-InJoonNeural.
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public static class CompletionAudio {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 struct Caps {
  public ushort manufacturer, product;
  public uint driver;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string name;
  public uint formats;
  public ushort channels, reserved;
  public uint support;
 }
 [StructLayout(LayoutKind.Sequential, Pack=2)]
 struct Format {
  public ushort tag, channels;
  public uint rate, bytesPerSecond;
  public ushort alignment, bits, extra;
 }
 [StructLayout(LayoutKind.Sequential)]
 struct Header {
  public IntPtr data;
  public uint length, recorded;
  public IntPtr user;
  public uint flags, loops;
  public IntPtr next, reserved;
 }
 [DllImport("winmm.dll")] static extern uint waveOutGetNumDevs();
 [DllImport("winmm.dll", CharSet=CharSet.Unicode)] static extern uint waveOutGetDevCapsW(UIntPtr id, out Caps caps, uint size);
 [DllImport("winmm.dll")] static extern uint waveOutOpen(out IntPtr handle, uint id, ref Format format, IntPtr callback, IntPtr instance, uint flags);
 [DllImport("winmm.dll")] static extern uint waveOutPrepareHeader(IntPtr handle, IntPtr header, uint size);
 [DllImport("winmm.dll")] static extern uint waveOutWrite(IntPtr handle, IntPtr header, uint size);
 [DllImport("winmm.dll")] static extern uint waveOutUnprepareHeader(IntPtr handle, IntPtr header, uint size);
 [DllImport("winmm.dll")] static extern uint waveOutReset(IntPtr handle);
 [DllImport("winmm.dll")] static extern uint waveOutClose(IntPtr handle);
 static void Check(uint result) { if(result!=0) throw new InvalidOperationException("Audio output error: "+result); }
 public static string[] Devices() {
  var names=new string[waveOutGetNumDevs()];
  for(uint i=0;i<names.Length;i++) { Caps caps; Check(waveOutGetDevCapsW((UIntPtr)i,out caps,(uint)Marshal.SizeOf(typeof(Caps)))); names[i]=caps.name; }
  return names;
 }
 public static string Play(string pattern,string wavePath) {
  var names=Devices(); int device=Array.FindIndex(names,n=>n.IndexOf(pattern,StringComparison.OrdinalIgnoreCase)>=0);
  if(device<0) throw new InvalidOperationException("No output matching: "+pattern);
  var format=new Format(); byte[] pcm=null;
  using(var reader=new BinaryReader(File.OpenRead(wavePath))) {
   if(reader.ReadUInt32()!=0x46464952)throw new InvalidDataException("Not a WAV file.");
   reader.ReadUInt32();
   if(reader.ReadUInt32()!=0x45564157)throw new InvalidDataException("Not a WAVE stream.");
   while(reader.BaseStream.Position+8<=reader.BaseStream.Length) {
    uint id=reader.ReadUInt32(),length=reader.ReadUInt32();long end=reader.BaseStream.Position+length;
    if(end>reader.BaseStream.Length)throw new InvalidDataException("Truncated WAV chunk.");
    if(id==0x20746d66&&length>=16) {
     format.tag=reader.ReadUInt16();format.channels=reader.ReadUInt16();format.rate=reader.ReadUInt32();
     format.bytesPerSecond=reader.ReadUInt32();format.alignment=reader.ReadUInt16();format.bits=reader.ReadUInt16();
    }
    if(id==0x61746164)pcm=reader.ReadBytes(checked((int)length));
    reader.BaseStream.Position=end+(length%2);
   }
  }
  if(format.tag!=1||format.bits!=16||format.bytesPerSecond==0||pcm==null||pcm.Length==0)
   throw new InvalidDataException("Expected nonempty 16-bit PCM speech.");
  IntPtr handle=IntPtr.Zero,buffer=IntPtr.Zero,header=IntPtr.Zero; bool prepared=false;
  uint size=(uint)Marshal.SizeOf(typeof(Header));
  try {
   Check(waveOutOpen(out handle,(uint)device,ref format,IntPtr.Zero,IntPtr.Zero,0));
   buffer=Marshal.AllocHGlobal(pcm.Length); Marshal.Copy(pcm,0,buffer,pcm.Length);
   header=Marshal.AllocHGlobal((int)size); Marshal.StructureToPtr(new Header{data=buffer,length=(uint)pcm.Length},header,false);
   Check(waveOutPrepareHeader(handle,header,size)); prepared=true; Check(waveOutWrite(handle,header,size));
   var deadline=DateTime.UtcNow.AddSeconds(Math.Max(5,pcm.Length/(double)format.bytesPerSecond+3));
   while((((Header)Marshal.PtrToStructure(header,typeof(Header))).flags&1)==0) {
    if(DateTime.UtcNow>deadline) throw new TimeoutException("Audio device did not finish playback.");
    Thread.Sleep(10);
   }
   return names[device];
  } finally {
   if(handle!=IntPtr.Zero) { waveOutReset(handle); if(prepared)waveOutUnprepareHeader(handle,header,size); waveOutClose(handle); }
   if(header!=IntPtr.Zero)Marshal.FreeHGlobal(header); if(buffer!=IntPtr.Zero)Marshal.FreeHGlobal(buffer);
  }
 }
}
'@

if ($List) { [CompletionAudio]::Devices() } else {
 $notificationWave = Join-Path $PSScriptRoot 'audio\completion-ko-male.wav'
 [CompletionAudio]::Play($DevicePattern, $notificationWave)
}
