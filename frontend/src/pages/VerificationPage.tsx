import WaveformPlayer from "../components/WaveformPlayer";

const VerificationPage = () => {
  return (
    <div className="bg-gray-900 text-white min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">Verification Page</h1>
      <p className="mb-4">
        This page is for verifying that the demuxer error is resolved.
      </p>
      <WaveformPlayer
        src="https://cdn.discordapp.com/attachments/1432763621997285447/1432763783951945840/Tipsy-Ctrl-Dubstep.mp3?ex=69023cc1&is=6900eb41&hm=dc52a8a12dd14056a9f7b3b94af63f94659ad44748e191546ccfa99a35d20597&"
        header="Test Audio for Demuxer Error Verification"
      />
    </div>
  );
};

export default VerificationPage;
